import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function check() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    
    const [cols] = await conn.execute('DESCRIBE memo_system_users');
    console.log('=== USER COLS ===');
    console.log(cols.map(c => c.Field));

    const [users] = await conn.execute('SELECT u.*, r.name as role_name FROM memo_system_users u LEFT JOIN user_roles ur ON u.id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id WHERE u.email LIKE "%ojiako%" OR u.email LIKE "%chidi%"');
    console.log('=== USERS ===');
    console.log(users);
    
    const [staff] = await conn.execute('SELECT * FROM hr_staff WHERE StaffID = "E0152"');
    console.log('=== HR STAFF E0152 ===');
    console.log(staff);
    
    const [roles] = await conn.execute('SELECT * FROM roles');
    console.log('=== ROLES ===');
    console.log(roles);
    
    await conn.end();
}

check().catch(console.error);
