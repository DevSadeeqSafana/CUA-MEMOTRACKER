// Puts every memo approved by an approver-group member into the Accountant's
// finance queue, whether or not it is a finance/budget memo.
// Dry run by default; pass --apply to write.
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
if (!process.env.DB_HOST) {
    dotenv.config({ path: '.env', quiet: true });
}

const apply = process.argv.includes('--apply');

async function run() {
    console.log(`--- Approver Group → Accountant Backfill (${apply ? 'APPLY' : 'DRY RUN'}) ---`);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        const [accountants] = await connection.execute(`
            SELECT u.id FROM memo_system_users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'Accountant'
            LIMIT 1
        `);
        if (accountants.length === 0) throw new Error('No Accountant user found.');
        const accountantId = accountants[0].id;

        // A group member "approved" a memo either as a step in the approval
        // chain (memo_approvals) or, under the earlier recipient flow, by
        // recording an Approved decision as a recipient (memo_recipients).
        // Memos created by Baba Ladan (user 104) are excluded on request.
        const [memos] = await connection.execute(`
            SELECT DISTINCT m.id, m.reference_number, m.title, m.status
            FROM memos m
            WHERE m.created_by != 104
            AND (
                EXISTS (SELECT 1 FROM memo_approvals a JOIN memo_approver_group g ON a.approver_id = g.user_id
                        WHERE a.memo_id = m.id AND a.status = 'Approved')
                OR EXISTS (SELECT 1 FROM memo_recipients mr JOIN memo_approver_group g ON mr.recipient_id = g.user_id
                           WHERE mr.memo_id = m.id AND mr.decision = 'Approved')
            )
            AND NOT EXISTS (SELECT 1 FROM memo_finance_processing fp WHERE fp.memo_id = m.id)
            ORDER BY m.id
        `);

        console.log(`Accountant user ID: ${accountantId}`);
        console.log(`${memos.length} approved memo(s) not yet in the finance queue:`);
        console.table(memos);

        if (!apply) {
            console.log('Dry run only. Re-run with --apply to add them to the queue.');
            return;
        }

        for (const memo of memos) {
            await connection.execute(
                `INSERT IGNORE INTO memo_finance_processing (memo_id, accountant_id, status) VALUES (?, ?, 'Pending Processing')`,
                [memo.id, accountantId]
            );
            await connection.execute(
                `INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, 'To')`,
                [memo.id, accountantId]
            );
        }
        console.log(`Added ${memos.length} memo(s) to the Accountant's finance queue.`);
    } catch (error) {
        console.error('Backfill failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

run();
