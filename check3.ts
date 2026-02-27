import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const { query } = await import('./src/lib/db.js');
    console.log("Checking ItemNames:");
    const names = await query(`SELECT ItemName, MAX(Quantity) as Quantity, MAX(Amount) as Amount FROM hr_finance_budget_item WHERE ItemName IS NOT NULL AND ItemName != '' GROUP BY ItemName ORDER BY ItemName ASC LIMIT 10`);
    console.log(names);
    process.exit(0);
}
check().catch(console.error);
