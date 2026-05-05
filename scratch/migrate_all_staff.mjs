
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    console.log('Connected to database.');

    try {
        // 1. Get Roles
        const [roles] = await connection.execute('SELECT * FROM roles');
        console.log('Available Roles:', roles);
        
        const recipientRole = roles.find(r => r.name === 'Recipient')?.id;
        const creatorRole = roles.find(r => r.name === 'Memo Creator')?.id;

        if (!recipientRole || !creatorRole) {
            console.error('Required roles (Recipient or Memo Creator) not found.');
            return;
        }

        // 2. Hash default password
        const passwordHash = await bcrypt.hash('123456', 10);
        console.log('Password hash generated.');

        // 3. Fetch HR Staff
        const [staffs] = await connection.execute('SELECT * FROM hr_staff WHERE IsActive = 1');
        console.log(`Found ${staffs.length} active staff members in HR database.`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const staff of staffs) {
            const email = staff.OfficialEmailAddress || staff.EmailAddress;
            if (!email) {
                console.warn(`Staff ${staff.StaffID} has no email, skipping.`);
                skippedCount++;
                continue;
            }

            const username = staff.OfficialEmailAddress ? staff.OfficialEmailAddress.split('@')[0] : `${staff.FirstName.toLowerCase()}.${staff.Surname.toLowerCase()}`;
            const department = staff.DepartmentCode || 'General';

            // Check if user already exists
            const [existing] = await connection.execute('SELECT id FROM memo_system_users WHERE staff_id = ? OR email = ?', [staff.StaffID, email]);
            
            if (existing.length > 0) {
                skippedCount++;
                continue;
            }

            const uuid = crypto.randomUUID();

            // Insert User
            const [result] = await connection.execute(
                `INSERT INTO memo_system_users (uuid, staff_id, username, email, password_hash, department, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuid, staff.StaffID, username, email, passwordHash, department, 1]
            );

            const userId = result.insertId;

            // Assign Roles
            await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, recipientRole]);
            await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, creatorRole]);

            migratedCount++;
            if (migratedCount % 10 === 0) console.log(`Migrated ${migratedCount} users...`);
        }

        console.log(`Migration complete!`);
        console.log(`- Migrated: ${migratedCount}`);
        console.log(`- Skipped (Existing/No Email): ${skippedCount}`);

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await connection.end();
    }
}

migrate();
