import { query } from './src/lib/db';

async function run() {
    try {
        await query("ALTER TABLE memo_system_users ADD COLUMN line_manager_staff_id VARCHAR(50);");
        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed:", e);
    }
    process.exit();
}

run();
