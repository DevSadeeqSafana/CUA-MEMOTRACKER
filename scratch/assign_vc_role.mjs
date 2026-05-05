
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function assignVC() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        const [roles] = await connection.execute('SELECT id FROM roles WHERE name = "VC"');
        if (!roles.length) {
            console.error('VC role not found in roles table.');
            return;
        }
        const vcRoleId = roles[0].id;

        const [users] = await connection.execute('SELECT id, username FROM memo_system_users WHERE email = "carl.adams@cosmopolitan.edu.ng"');
        if (!users.length) {
            console.error('User carl.adams@cosmopolitan.edu.ng not found.');
            return;
        }
        const userId = users[0].id;

        await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, vcRoleId]);
        console.log(`Successfully assigned VC role to ${users[0].username} (ID: ${userId}).`);

    } catch (error) {
        console.error('Error assigning VC role:', error);
    } finally {
        await connection.end();
    }
}

assignVC();
