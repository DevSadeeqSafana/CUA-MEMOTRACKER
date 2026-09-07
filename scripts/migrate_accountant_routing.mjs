import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DB_HOST) {
    dotenv.config({ path: '.env' });
}

async function run() {
    console.log('--- Starting Accountant & Finance Memo Migration ---');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // 1. Ensure Accountant role exists
        await connection.execute(`
            INSERT IGNORE INTO roles (id, name, description) 
            VALUES (7, 'Accountant', 'University Accountant - processes approved finance and budget memos')
            ON DUPLICATE KEY UPDATE description = VALUES(description)
        `);

        // Fetch Accountant role ID
        const [roles] = await connection.execute("SELECT id FROM roles WHERE name = 'Accountant'");
        const accountantRoleId = roles[0].id;
        console.log(`Accountant Role ID: ${accountantRoleId}`);

        // 2. Find Chidi Teddy Ojiako
        const [users] = await connection.execute(
            `SELECT id, email, username FROM memo_system_users WHERE email LIKE '%chidi.ojiako%' OR staff_id = 'E0152'`
        );

        if (users.length === 0) {
            console.error('Chidi Teddy Ojiako user not found in memo_system_users');
        } else {
            const chidi = users[0];
            console.log(`Found Chidi Teddy Ojiako (ID: ${chidi.id}, Email: ${chidi.email})`);

            // Assign Accountant role
            await connection.execute(
                `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
                [chidi.id, accountantRoleId]
            );
            console.log(`Assigned Accountant role to user ID ${chidi.id}`);
        }

        // 3. Create memo_finance_processing table
        console.log('Creating memo_finance_processing table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS memo_finance_processing (
                id INT AUTO_INCREMENT PRIMARY KEY,
                memo_id INT NOT NULL UNIQUE,
                accountant_id INT NOT NULL,
                status ENUM('Pending Processing', 'In Progress', 'Processed', 'Rejected') DEFAULT 'Pending Processing',
                processing_notes TEXT NULL,
                voucher_number VARCHAR(100) NULL,
                processed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
                FOREIGN KEY (accountant_id) REFERENCES memo_system_users(id)
            )
        `);
        console.log('memo_finance_processing table ready.');

        // 4. Backfill existing approved finance/budget memos
        const [accountants] = await connection.execute(
            `SELECT u.id FROM memo_system_users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role_id = ?`,
            [accountantRoleId]
        );

        if (accountants.length > 0) {
            const accountantId = accountants[0].id;
            console.log(`Primary Accountant ID for auto-routing: ${accountantId}`);

            const [financeMemos] = await connection.execute(`
                SELECT m.id, m.title, m.category 
                FROM memos m
                WHERE (
                    (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0
                    OR m.category LIKE '%Finance%'
                    OR m.category LIKE '%Budget%'
                )
                AND m.status = 'Distributed'
            `);

            console.log(`Found ${financeMemos.length} distributed finance/budget memos to backfill.`);

            for (const memo of financeMemos) {
                // Ensure recipient entry exists for accountant
                await connection.execute(
                    `INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, 'To')`,
                    [memo.id, accountantId]
                );

                // Insert into memo_finance_processing
                await connection.execute(
                    `INSERT IGNORE INTO memo_finance_processing (memo_id, accountant_id, status) VALUES (?, ?, 'Pending Processing')`,
                    [memo.id, accountantId]
                );
                console.log(`Routed Memo #${memo.id} ("${memo.title}") to Accountant.`);
            }
        }

        console.log('Migration completed successfully!');
    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        await connection.end();
    }
}

run();
