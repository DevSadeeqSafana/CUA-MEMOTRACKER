export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getMyInputRequests } from '@/lib/actions';
import ReviseMemoClient from './ReviseMemoClient';

export default async function ReviseMemoPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect('/');
    const currentUserId = parseInt(session.user.id);

    const memos = await query(
        `SELECT id, uuid, title, content, status, created_by FROM memos WHERE uuid = ? LIMIT 1`,
        [uuid]
    ) as any[];
    if (memos.length === 0) redirect('/dashboard/memos/my-memos');
    const memo = memos[0];

    // Gate 1: must be creator. Gate 2: not a draft (rejected drafts use /edit).
    if (memo.created_by !== currentUserId || memo.status === 'Draft') redirect(`/dashboard/memos/${uuid}`);

    // Gate 3: someone must have requested input from / commented to the creator
    const inputRequests = await getMyInputRequests(memo.id);
    if (inputRequests.length === 0) redirect(`/dashboard/memos/${uuid}`);

    const attachments = await query(
        `SELECT id, file_name, file_path, file_size FROM attachments WHERE memo_id = ? ORDER BY id ASC`,
        [memo.id]
    ) as any[];

    return (
        <div className="container mx-auto pb-10">
            <ReviseMemoClient
                memoId={memo.id}
                memoUuid={uuid}
                initialTitle={memo.title}
                initialContent={memo.content}
                attachments={attachments.map((a: any) => ({ ...a, file_size: Number(a.file_size) || 0 }))}
                inputRequests={inputRequests.map((r: any) => ({
                    id: r.id,
                    from_name: r.from_name,
                    message: r.message,
                    type: r.type,
                    created_at: new Date(r.created_at).toISOString(),
                }))}
            />
        </div>
    );
}
