
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function remigrate() {
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
        const recipientRole = roles.find(r => r.name === 'Recipient')?.id;
        const creatorRole = roles.find(r => r.name === 'Memo Creator')?.id;

        // 2. Hash default password
        const passwordHash = await bcrypt.hash('123456', 10);
        console.log('Generated hash for "123456"');

        // 3. Reset ALL existing passwords
        console.log('Resetting all existing user passwords to "123456"...');
        await connection.execute('UPDATE memo_system_users SET password_hash = ?', [passwordHash]);
        console.log('Existing passwords reset.');

        // 4. Fetch all HR Staff
        const [staffs] = await connection.execute('SELECT * FROM hr_staff');
        console.log(`Found ${staffs.length} staff members in HR records.`);

        let newUsersCount = 0;
        let skippedCount = 0;

        for (const staff of staffs) {
            // Check if user already exists
            const [existing] = await connection.execute('SELECT id FROM memo_system_users WHERE staff_id = ?', [staff.StaffID]);
            
            if (existing.length > 0) {
                continue; // Already handled by the bulk update
            }

            // Get or generate email
            let email = staff.OfficialEmailAddress || staff.EmailAddress;
            if (!email) {
                // If no email, generate a fallback based on StaffID
                email = `${staff.StaffID.toLowerCase()}@cosmopolitan.edu.ng`;
                console.log(`Generating fallback email for ${staff.StaffID}: ${email}`);
            }

            const username = staff.OfficialEmailAddress 
                ? staff.OfficialEmailAddress.split('@')[0] 
                : (staff.FirstName && staff.Surname 
                    ? `${staff.FirstName.toLowerCase()}.${staff.Surname.toLowerCase()}`
                    : staff.StaffID.toLowerCase());
            
            const department = staff.DepartmentCode || 'General';
            const uuid = crypto.randomUUID();

            try {
                // Insert User
                const [result] = await connection.execute(
                    `INSERT INTO memo_system_users (uuid, staff_id, username, email, password_hash, department, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuid, staff.StaffID, username, email, passwordHash, department, 1]
                );

                const userId = result.insertId;

                // Assign Roles
                await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, recipientRole]);
                await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, creatorRole]);

                newUsersCount++;
            } catch (err) {
                console.error(`Failed to insert staff ${staff.StaffID}:`, err.message);
                skippedCount++;
            }
        }

        console.log(`\nOperation Complete!`);
        console.log(`- New Users Added: ${newUsersCount}`);
        console.log(`- Failed/Skipped: ${skippedCount}`);
        console.log(`- All accounts now have "123456" as password.`);

    } catch (error) {
        console.error('Operation error:', error);
    } finally {
        await connection.end();
    }
}

remigrate();
