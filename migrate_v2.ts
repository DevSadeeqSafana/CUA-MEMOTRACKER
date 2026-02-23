import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log("Checking columns...");
        const [rows] = await connection.execute('SHOW COLUMNS FROM memo_system_users');
        console.log("Columns:", rows);

        const hasLineManagerId = (rows as any[]).some(r => r.Field === 'line_manager_id');
        if (!hasLineManagerId) {
            console.log("Adding line_manager_id column...");
            await connection.execute('ALTER TABLE memo_system_users ADD COLUMN line_manager_id INT NULL');
            await connection.execute('ALTER TABLE memo_system_users ADD FOREIGN KEY (line_manager_id) REFERENCES memo_system_users(id) ON DELETE SET NULL');
            console.log("Column added successfully.");
        } else {
            console.log("line_manager_id column already exists.");
        }
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await connection.end();
    }
}

run();
