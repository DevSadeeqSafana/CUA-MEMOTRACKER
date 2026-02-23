import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { query } from './src/lib/db';
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
