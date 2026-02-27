import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
    const { query } = await import('./src/lib/db.js');
    console.log("Adding decision column to memo_recipients");
    try {
        await query("ALTER TABLE memo_recipients ADD COLUMN decision VARCHAR(20) DEFAULT NULL");
        console.log("Added decision column.");
    } catch (e: any) {
        console.log("Maybe already added?", e.message);
    }
    process.exit(0);
}
migrate().catch(console.error);
