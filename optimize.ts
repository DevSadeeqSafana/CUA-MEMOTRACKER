import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function optimize() {
    console.log("Starting database optimization...");
    const { query } = await import('./src/lib/db.js');

    const indexes = [
        { table: 'memos', name: 'idx_memos_uuid', col: 'uuid' },
        { table: 'memos', name: 'idx_memos_status', col: 'status' },
        { table: 'memos', name: 'idx_memos_created_by', col: 'created_by' },
        { table: 'memos', name: 'idx_memos_ref', col: 'reference_number' },

        { table: 'memo_recipients', name: 'idx_mr_memo', col: 'memo_id' },
        { table: 'memo_recipients', name: 'idx_mr_recipient', col: 'recipient_id' },

        { table: 'memo_approvals', name: 'idx_ma_memo', col: 'memo_id' },
        { table: 'memo_approvals', name: 'idx_ma_approver', col: 'approver_id' },
        { table: 'memo_approvals', name: 'idx_ma_status', col: 'status' },

        { table: 'memo_consultations', name: 'idx_mc_memo', col: 'memo_id' },
        { table: 'memo_consultations', name: 'idx_mc_to', col: 'to_user_id' },

        { table: 'hr_finance_budget_item', name: 'idx_hfbi_item_name', col: 'ItemName' }
    ];

    for (const idx of indexes) {
        try {
            await query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.col})`);
            console.log(`Created index ${idx.name} on ${idx.table}(${idx.col})`);
        } catch (error: any) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log(`Index ${idx.name} already exists. Skipping.`);
            } else {
                console.log(`Could not create index ${idx.name}: ${error.message}`);
            }
        }
    }

    console.log("Database optimization complete!");
    process.exit(0);
}

optimize().catch(console.error);
