import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import path from 'path';

async function runMigration() {
    const envFile = readFileSync('.env.local', 'utf-8');
    const env = Object.fromEntries(
        envFile.split('\n')
            .filter(l => l.includes('='))
            .map(l => {
                const parts = l.split('=');
                return [parts[0].trim(), parts.slice(1).join('=').trim()];
            })
    );

    const connection = await mysql.createConnection({
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        ssl: { rejectUnauthorized: false }
    });

    const migrationSql = `
        -- 1. Update memo_recipients to support types (To, CC, BCC)
        ALTER TABLE memo_recipients ADD COLUMN recipient_type ENUM('To', 'CC', 'BCC') DEFAULT 'To' AFTER recipient_id;

        -- 2. Ensure 'Approval' is in memo_type
        ALTER TABLE memos MODIFY COLUMN memo_type ENUM('Informational', 'Approval', 'Action') NOT NULL;

        -- 3. Add VC role if not exists
        INSERT IGNORE INTO roles (name, description) VALUES ('VC', 'Vice Chancellor - receives a copy of all processed memos');
    `;

    try {
        console.log('Running migration...');
        // Execute queries one by one because execute() usually doesn't like multiple statements
        await connection.query("ALTER TABLE memo_recipients ADD COLUMN recipient_type ENUM('To', 'CC', 'BCC') DEFAULT 'To' AFTER recipient_id");
        console.log('✅ Added recipient_type to memo_recipients');
        
        await connection.query("ALTER TABLE memos MODIFY COLUMN memo_type ENUM('Informational', 'Approval', 'Action') NOT NULL");
        console.log('✅ Updated memo_type in memos');

        await connection.query("INSERT IGNORE INTO roles (name, description) VALUES ('VC', 'Vice Chancellor - receives a copy of all processed memos')");
        console.log('✅ Added VC role');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

runMigration();
