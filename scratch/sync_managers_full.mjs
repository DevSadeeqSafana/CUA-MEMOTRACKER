
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function syncManagers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Syncing line_manager_id from HR records...');
        
        // 1. Update line_manager_id in memo_system_users based on hr_staff.LineManagerID
        // We join u with hr to get the manager's staff_id, then join with u again to get the manager's internal id
        await connection.execute(`
            UPDATE memo_system_users u
            JOIN hr_staff hr ON u.staff_id = hr.StaffID
            JOIN memo_system_users mgr ON hr.LineManagerID = mgr.staff_id
            SET u.line_manager_id = mgr.id
            WHERE u.line_manager_id IS NULL OR u.line_manager_id != mgr.id
        `);

        console.log('line_manager_id synchronization complete.');

        // 2. Sync Roles
        const [roles] = await connection.execute('SELECT id FROM roles WHERE name = "Line Manager"');
        const lmRoleId = roles[0].id;

        const [managers] = await connection.execute('SELECT DISTINCT line_manager_id FROM memo_system_users WHERE line_manager_id IS NOT NULL');
        console.log(`Found ${managers.length} unique line managers.`);

        let assignedCount = 0;
        for (const mgr of managers) {
            const [result] = await connection.execute(
                'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
                [mgr.line_manager_id, lmRoleId]
            );
            if (result.affectedRows > 0) assignedCount++;
        }

        console.log(`Assigned 'Line Manager' role to ${assignedCount} additional users.`);

    } catch (error) {
        console.error('Error syncing managers:', error);
    } finally {
        await connection.end();
    }
}

syncManagers();
