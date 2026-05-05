
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function syncManagerRoles() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // 1. Get Line Manager Role ID
        const [roles] = await connection.execute('SELECT id FROM roles WHERE name = "Line Manager"');
        if (!roles.length) {
            console.error('Line Manager role not found.');
            return;
        }
        const lmRoleId = roles[0].id;

        // 2. Find all unique line_manager_id values currently assigned to users
        const [managers] = await connection.execute('SELECT DISTINCT line_manager_id FROM memo_system_users WHERE line_manager_id IS NOT NULL');
        
        console.log(`Found ${managers.length} unique line managers in the system.`);

        let assignedCount = 0;
        for (const mgr of managers) {
            const managerUserId = mgr.line_manager_id;
            
            // Assign the 'Line Manager' role if they don't have it
            const [result] = await connection.execute(
                'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
                [managerUserId, lmRoleId]
            );
            
            if (result.affectedRows > 0) {
                assignedCount++;
            }
        }

        console.log(`Successfully assigned 'Line Manager' role to ${assignedCount} users.`);

    } catch (error) {
        console.error('Error syncing manager roles:', error);
    } finally {
        await connection.end();
    }
}

syncManagerRoles();
