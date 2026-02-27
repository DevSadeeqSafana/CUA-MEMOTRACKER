import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const { query } = await import('./src/lib/db.js');
    console.log("Describing memo_recipients:");
    const desc = await query("DESCRIBE memo_recipients");
    console.log(desc);
    process.exit(0);
}
check().catch(console.error);
