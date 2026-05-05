
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixPendingMemos() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // Find memos that were incorrectly distributed (skipped manager review)
        // These are memos where:
        // - Created by a user who NOW has a line_manager_id
        // - But NO pending/approved approval entry exists
        // - Status is NOT Draft
        const [skippedMemos] = await connection.execute(`
            SELECT m.id, m.title, m.status, m.created_by, u.username as creator, u.line_manager_id,
                   mgr.username as manager_name
            FROM memos m
            JOIN memo_system_users u ON m.created_by = u.id
            JOIN memo_system_users mgr ON u.line_manager_id = mgr.id
            WHERE m.status NOT IN ('Draft', 'Archived')
            AND NOT EXISTS (
                SELECT 1 FROM memo_approvals a WHERE a.memo_id = m.id AND a.approver_id = u.line_manager_id
            )
            ORDER BY m.created_at DESC
        `);

        console.log(`Found ${skippedMemos.length} memos that bypassed line manager review.`);

        if (skippedMemos.length === 0) {
            console.log('No memos to fix.');
            return;
        }

        let fixedCount = 0;
        for (const memo of skippedMemos) {
            console.log(`Fixing memo #${memo.id}: "${memo.title}" (creator: ${memo.creator} -> manager: ${memo.manager_name})`);

            // Insert the missing approval entry (Pending)
            await connection.execute(
                'INSERT IGNORE INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                [memo.id, memo.line_manager_id, 1, 'Pending']
            );

            // Revert status to Line Manager Review if it was Distributed/other
            if (memo.status !== 'Line Manager Review') {
                await connection.execute(
                    'UPDATE memos SET status = "Line Manager Review" WHERE id = ?',
                    [memo.id]
                );
            }

            // Notify the manager
            await connection.execute(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [memo.line_manager_id, memo.id, `A memo "${memo.title}" requires your review and approval.`]
            );

            fixedCount++;
        }

        console.log(`\nFixed ${fixedCount} memo(s). Line managers have been notified.`);

    } catch (error) {
        console.error('Error fixing memos:', error);
    } finally {
        await connection.end();
    }
}

fixPendingMemos();
