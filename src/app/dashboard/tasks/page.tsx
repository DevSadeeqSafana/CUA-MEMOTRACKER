export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { Inbox } from 'lucide-react';
import MemoInboxContainer from '@/components/memos/MemoInboxContainer';

export default async function MemoCenterPage({
    searchParams,
}: {
    searchParams: Promise<{ folder?: string; tab?: string }>;
}) {
    const resolvedSearchParams = await searchParams;
    const session = await auth();
    if (!session?.user) return null;
    const userId = session.user.id;
    const folder = resolvedSearchParams.folder || 'inbox';

    // 1. Fetch distributed memos (Memos sent to the user as a recipient)
    const distributed = await query(`
        SELECT m.id, m.uuid, m.title, m.reference_number, m.content, m.priority, m.memo_type, m.category, m.status, m.created_at, m.department,
               COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name,
               mr.read_at, mr.acknowledged_at,
               (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo,
               (SELECT COUNT(*) FROM attachments a WHERE a.memo_id = m.id) as attachment_count
        FROM memos m
        JOIN memo_recipients mr ON m.id = mr.memo_id
        JOIN memo_system_users u ON m.created_by = u.id
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE mr.recipient_id = ? AND m.status = 'Distributed'
        ORDER BY m.created_at DESC
    `, [userId]) as any[];

    // 2. Fetch pending approvals (Memos waiting for this user's approval)
    const approvals = await query(`
        SELECT m.id, m.uuid, m.title, m.reference_number, m.content, m.priority, m.memo_type, m.category, m.status, m.created_at, m.department,
               COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name,
               a.step_order, a.id as approval_id,
               (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo,
               (SELECT COUNT(*) FROM attachments a WHERE a.memo_id = m.id) as attachment_count
        FROM memos m 
        JOIN memo_approvals a ON m.id = a.memo_id 
        JOIN memo_system_users u ON m.created_by = u.id 
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE a.approver_id = ? 
        AND a.status = 'Pending' 
        AND NOT EXISTS (
            SELECT 1 FROM memo_approvals a2 
            WHERE a2.memo_id = m.id 
            AND a2.step_order < a.step_order 
            AND a2.status != 'Approved'
        )
        ORDER BY m.created_at DESC
    `, [userId]) as any[];

    // 3. Fetch pending consultations (Forwards requiring user response)
    const consultations = await query(`
        SELECT m.id, m.uuid, m.title, m.reference_number, m.content, m.priority, m.memo_type, m.category, m.status, m.created_at, m.department,
               COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name,
               c.created_at as forwarded_at, c.id as consultation_id,
               COALESCE(CONCAT(fhs.FirstName, ' ', IFNULL(CONCAT(fhs.MiddleName, ' '), ''), fhs.Surname), fu.username) as forwarded_by, 
               (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo,
               (SELECT COUNT(*) FROM attachments a WHERE a.memo_id = m.id) as attachment_count
        FROM memos m
        JOIN memo_consultations c ON m.id = c.memo_id
        JOIN memo_system_users u ON m.created_by = u.id
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        JOIN memo_system_users fu ON c.from_user_id = fu.id
        LEFT JOIN hr_staff fhs ON fu.staff_id = fhs.StaffID
        WHERE c.to_user_id = ? AND c.type = 'Forward'
        AND NOT EXISTS (
            SELECT 1 FROM memo_consultations r 
            WHERE r.parent_id = c.id AND r.from_user_id = ? AND r.type = 'Response'
        )
        ORDER BY c.created_at DESC
    `, [userId, userId]) as any[];

    // 4. Fetch created memos (Sent items & drafts created by this user)
    const created = await query(`
        SELECT m.id, m.uuid, m.title, m.reference_number, m.content, m.priority, m.memo_type, m.category, m.status, m.created_at, m.department,
               COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name,
               (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo,
               (SELECT COUNT(*) FROM attachments a WHERE a.memo_id = m.id) as attachment_count
        FROM memos m
        JOIN memo_system_users u ON m.created_by = u.id
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE m.created_by = ?
        ORDER BY m.created_at DESC
    `, [userId]) as any[];

    // --- Unify Memos List ---
    const unifiedMemos: any[] = [];
    const memoIdsSeen = new Set<string>();

    // Add Pending Approvals
    approvals.forEach(m => {
        const key = `action-approval-${m.id}`;
        if (!memoIdsSeen.has(key)) {
            memoIdsSeen.add(key);
            unifiedMemos.push({
                ...m,
                folder: 'actions',
                is_unread: true,
                is_starred: m.priority === 'High',
                action_type: 'Approval'
            });
        }
    });

    // Add Pending Consultations
    consultations.forEach(m => {
        const key = `action-consultation-${m.id}`;
        if (!memoIdsSeen.has(key)) {
            memoIdsSeen.add(key);
            unifiedMemos.push({
                ...m,
                folder: 'actions',
                is_unread: true,
                is_starred: m.priority === 'High',
                action_type: 'Consultation',
                forwarded_by: m.forwarded_by
            });
        }
    });

    // Add Distributed Inbox Memos
    distributed.forEach(m => {
        const key = `inbox-${m.id}`;
        if (!memoIdsSeen.has(key)) {
            memoIdsSeen.add(key);
            unifiedMemos.push({
                ...m,
                folder: 'inbox',
                is_unread: m.acknowledged_at === null,
                is_starred: m.priority === 'High',
                action_type: null
            });
        }
    });

    // Add User Created Memos (Sent and Drafts)
    created.forEach(m => {
        const folderType = m.status === 'Draft' ? 'drafts' : 'sent';
        const key = `${folderType}-${m.id}`;
        if (!memoIdsSeen.has(key)) {
            memoIdsSeen.add(key);
            unifiedMemos.push({
                ...m,
                folder: folderType,
                is_unread: false,
                is_starred: m.priority === 'High',
                action_type: null
            });
        }
    });

    // Sort combined list chronologically (Newest first)
    unifiedMemos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <MemoInboxContainer memos={unifiedMemos} initialFolder={folder} />
        </div>
    );
}
