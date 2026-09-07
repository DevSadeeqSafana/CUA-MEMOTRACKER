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
    const [userRoles] = await conn.execute(
        `SELECT u.id, u.email, r.name 
         FROM memo_system_users u 
         JOIN user_roles ur ON u.id = ur.user_id 
         JOIN roles r ON ur.role_id = r.id 
         WHERE r.name = 'Accountant' OR u.id = 116`
    );
    console.log('Accountant / Chidi roles:', userRoles);
    
    const [tables] = await conn.execute('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]));
    
    // Check if finance_processing or memo_accountant_routing table exists
    const [cols] = await conn.execute('SHOW COLUMNS FROM memos');
    console.log('Memos table columns:', cols.map(c => c.Field));

    await conn.end();
}
check().catch(console.error);
