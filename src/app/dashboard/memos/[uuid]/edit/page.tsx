export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { getRecipients } from '@/lib/actions';
import EditMemoClient from './EditMemoClient';

export default async function EditDraftPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect('/login');
    const userId = parseInt(session.user.id);

    // Fetch the draft memo — must belong to current user and be a Draft
    const memos = await query(
        `SELECT m.*, bi.year_id, bi.budget_category, bi.other_category
         FROM memos m
         LEFT JOIN memo_budget_info bi ON m.id = bi.memo_id
         WHERE m.uuid = ? AND m.created_by = ? AND m.status = 'Draft'
         LIMIT 1`,
        [uuid, userId]
    ) as any[];

    if (memos.length === 0) notFound();
    const memo = memos[0];

    // Existing recipients
    const existingRecipients = await query(
        `SELECT mr.recipient_id, mr.recipient_type,
                COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as username,
                u.department
         FROM memo_recipients mr
         JOIN memo_system_users u ON mr.recipient_id = u.id
         LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
         WHERE mr.memo_id = ?`,
        [memo.id]
    ) as any[];

    // Existing budget items
    const budgetItems = await query(
        `SELECT name, description, quantity, amount, total FROM memo_budget_items WHERE memo_id = ?`,
        [memo.id]
    ) as any[];

    const allRecipients = await getRecipients();

    return (
        <EditMemoClient
            memo={memo}
            memoId={memo.id}
            existingRecipients={existingRecipients}
            budgetItems={budgetItems}
            allRecipients={allRecipients}
        />
    );
}
