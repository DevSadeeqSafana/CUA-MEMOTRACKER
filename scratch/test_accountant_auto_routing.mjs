import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DB_HOST) {
    dotenv.config({ path: '.env' });
}

async function testAutoRouting() {
    console.log('--- Testing Accountant Auto-Routing ---');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // 1. Get Chidi Teddy Ojiako ID
        const [chidiRows] = await connection.execute(
            `SELECT u.id, u.email, r.name as role_name 
             FROM memo_system_users u 
             JOIN user_roles ur ON u.id = ur.user_id 
             JOIN roles r ON ur.role_id = r.id 
             WHERE r.name = 'Accountant'`
        );
        console.log('Accountant User(s):', chidiRows);

        // 2. Count memos in memo_finance_processing
        const [financeRecords] = await connection.execute(
            `SELECT fp.*, m.title, m.category 
             FROM memo_finance_processing fp 
             JOIN memos m ON fp.memo_id = m.id`
        );
        console.log(`Current Finance Processing Records (${financeRecords.length}):`, financeRecords);

    } catch (e) {
        console.error('Test error:', e);
    } finally {
        await connection.end();
    }
}

testAutoRouting();
