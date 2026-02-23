import { query } from './src/lib/db.js';

async function run() {
    try {
        const res = await query('SHOW COLUMNS FROM memo_system_users');
        console.log("COLUMNS:", res);
    } catch (e) {
        console.error("error:", e);
    }
    process.exit();
}

run();
