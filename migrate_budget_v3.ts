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
        console.log("Creating/Updating memo_budget_info table...");

        // Create table if not exists with basic structure
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS memo_budget_info (
                id INT AUTO_INCREMENT PRIMARY KEY,
                memo_id INT NOT NULL,
                budget_type VARCHAR(100),
                budget_category VARCHAR(100),
                budget_item_id INT NULL,
                FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
            )
        `);

        // Check for new columns and add them if missing
        const [columns] = await connection.execute('SHOW COLUMNS FROM memo_budget_info');
        const existingFields = (columns as any[]).map(c => c.Field);

        const newColumns = [
            { field: 'budget_id_ref', type: 'VARCHAR(100)' },
            { field: 'year_id', type: 'VARCHAR(50)' },
            { field: 'item_name', type: 'VARCHAR(255)' },
            { field: 'item_description', type: 'TEXT' },
            { field: 'quantity', type: 'INT DEFAULT 1' },
            { field: 'amount', type: 'DECIMAL(15, 2)' },
            { field: 'total', type: 'DECIMAL(15, 2)' }
        ];

        for (const col of newColumns) {
            if (!existingFields.includes(col.field)) {
                console.log(`Adding ${col.field} column...`);
                await connection.execute(`ALTER TABLE memo_budget_info ADD COLUMN ${col.field} ${col.type}`);
            }
        }

        console.log("Budget table migration successful.");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await connection.end();
    }
}

run();
