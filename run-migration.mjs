// run-migration.mjs
// Uses the project's .env.local to connect and run the memo_consultations migration.
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf-8')
        .split('\n')
        .filter(l => l.includes('='))
        .map(l => l.split('=').map(s => s.trim()))
);

const pool = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS memo_consultations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    memo_id         INT NOT NULL,
    from_user_id    INT NOT NULL,
    to_user_id      INT NOT NULL,
    message         TEXT NOT NULL,
    parent_id       INT NULL,
    type            ENUM('Forward', 'Response') NOT NULL DEFAULT 'Forward',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (memo_id)        REFERENCES memos(id)              ON DELETE CASCADE,
    FOREIGN KEY (from_user_id)   REFERENCES memo_system_users(id),
    FOREIGN KEY (to_user_id)     REFERENCES memo_system_users(id),
    FOREIGN KEY (parent_id)      REFERENCES memo_consultations(id)  ON DELETE CASCADE
)
`;

try {
    await pool.execute(sql);
    console.log('✅ memo_consultations table created (or already exists).');
} catch (err) {
    console.error('❌ Migration failed:', err.message);
} finally {
    await pool.end();
}
