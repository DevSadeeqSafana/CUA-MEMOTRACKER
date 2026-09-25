import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DB_HOST) {
    dotenv.config({ path: '.env' });
}

async function run() {
    console.log('--- Starting Approver Group Migration ---');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true,
    });

    try {
        const sql = await readFile(new URL('../migrations/20260925_approver_group.sql', import.meta.url), 'utf8');
        await connection.query(sql);

        const [members] = await connection.execute(`
            SELECT u.id, u.username, u.staff_id
            FROM memo_approver_group g
            JOIN memo_system_users u ON g.user_id = u.id
        `);
        console.log('Approver group members:');
        console.table(members);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

run();
