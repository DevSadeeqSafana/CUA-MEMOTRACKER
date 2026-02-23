import { auth } from '@/auth';
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const userId = session.user.id;

    if (!q || q.length < 3) {
        return NextResponse.json({ results: [] });
    }

    try {
        // RBAC: Users can search memos they created, memos where they are recipients, or memos where they are approvers
        // For simplicity, we filter by these relations. Administrators (if checked) could see all.
        const results = await query(
            `SELECT DISTINCT m.id, m.uuid, m.title, m.reference_number, m.status
       FROM memos m
       LEFT JOIN memo_recipients mr ON m.id = mr.memo_id
       LEFT JOIN memo_approvals ma ON m.id = ma.memo_id
       WHERE (m.title LIKE ? OR m.reference_number LIKE ?)
       AND (m.created_by = ? OR mr.recipient_id = ? OR ma.approver_id = ?)
       LIMIT 10`,
            [`%${q}%`, `%${q}%`, userId, userId, userId]
        );

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
