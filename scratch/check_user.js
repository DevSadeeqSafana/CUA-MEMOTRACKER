import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import mysql from 'mysql2/promise';

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [staff] = await pool.query('SELECT * FROM hr_staff WHERE StaffID = "E0152"');
    console.log('hr_staff:', staff);
    
    const [user] = await pool.query('SELECT * FROM memo_system_users WHERE email LIKE "%ojiako%"');
    console.log('memo_system_user:', user);

    if (user.length > 0) {
        const [roles] = await pool.query('SELECT r.* FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?', [user[0].id]);
        console.log('Chidi Ojiako roles:', roles);
    }

    pool.end();
}

run().catch(console.error);
