export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getRecipients } from '@/lib/actions';
import EditMemoClient from './EditMemoClient';

export default async function EditMemoPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect('/');
    const currentUserId = parseInt(session.user.id);

    // Fetch the memo
    const memos = await query(
        `SELECT m.*, bi.year_id, bi.budget_category, bi.other_category
         FROM memos m
         LEFT JOIN memo_budget_info bi ON m.id = bi.memo_id
         WHERE m.uuid = ? LIMIT 1`,
        [uuid]
    ) as any[];

    if (memos.length === 0) redirect('/dashboard/memos/my-memos');
    const memo = memos[0];

    // Gate 1: must be creator
    if (memo.created_by !== currentUserId) redirect(`/dashboard/memos/${uuid}`);

    // Gate 2: must be in Draft
    if (memo.status !== 'Draft') redirect(`/dashboard/memos/${uuid}`);

    // Gate 3: must have at least one Rejected approval record
    const rejections = await query(
        `SELECT id, comments, processed_at,
                COALESCE(CONCAT(hs.FirstName, ' ', hs.Surname), u.username) as rejector_name
         FROM memo_approvals a
         JOIN memo_system_users u ON a.approver_id = u.id
         LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
         WHERE a.memo_id = ? AND a.status = 'Rejected'
         ORDER BY a.processed_at DESC`,
        [memo.id]
    ) as any[];

    if (rejections.length === 0) redirect(`/dashboard/memos/${uuid}`);

    // Fetch existing recipients
    const existingRecipients = await query(
        `SELECT recipient_id, recipient_type FROM memo_recipients WHERE memo_id = ?`,
        [memo.id]
    ) as any[];

    // Fetch existing budget items
    const budgetItems = await query(
        `SELECT name, description, quantity, amount, total FROM memo_budget_items WHERE memo_id = ?`,
        [memo.id]
    ) as any[];

    const recipients = await getRecipients();

    const toIds  = existingRecipients.filter((r: any) => r.recipient_type === 'To').map((r: any) => r.recipient_id);
    const ccIds  = existingRecipients.filter((r: any) => r.recipient_type === 'CC').map((r: any) => r.recipient_id);
    const bccIds = existingRecipients.filter((r: any) => r.recipient_type === 'BCC').map((r: any) => r.recipient_id);

    return (
        <div className="container mx-auto pb-10">
            <EditMemoClient
                memo={memo}
                memoId={memo.id}
                memoUuid={uuid}
                rejections={rejections}
                recipients={recipients}
                initialData={{
                    title: memo.title,
                    department: memo.department,
                    category: memo.category,
                    priority: memo.priority,
                    memo_type: memo.memo_type,
                    expiry_date: memo.expiry_date ? new Date(memo.expiry_date).toISOString().split('T')[0] : '',
                    content: memo.content,
                    recipient_ids: toIds,
                    cc_ids: ccIds,
                    bcc_ids: bccIds,
                    is_budget_memo: budgetItems.length > 0,
                    year_id: memo.year_id || '',
                    budget_category: memo.budget_category || '',
                    other_category: memo.other_category || '',
                    budget_items: budgetItems.length > 0 ? budgetItems : undefined,
                }}
            />
        </div>
    );
}
