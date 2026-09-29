import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CREATOR_NAME = `COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username)`;

/**
 * GET /api/memos/reference-search?q=...
 * Suggestions for "@" memo references in the editor. Ranked: exact title, title starts with
 * the query, title contains it, then titles sharing the most words with it.
 * Covers every submitted memo in the system (drafts excluded). With an empty query,
 * returns the most recent memos.
 */
export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 120);

    try {
        if (!q) {
            const recent = await query(
                `SELECT m.uuid, m.title, m.reference_number, ${CREATOR_NAME} as creator_name
                 FROM memos m
                 JOIN memo_system_users u ON m.created_by = u.id
                 LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                 WHERE m.status != 'Draft'
                 ORDER BY m.created_at DESC
                 LIMIT 8`
            );
            return NextResponse.json({ results: recent });
        }

        // Escape LIKE wildcards so "%" or "_" in the query match literally
        const like = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);
        const words = Array.from(new Set(q.toLowerCase().split(/\s+/).filter(w => w.length >= 2))).slice(0, 6);
        const wordScore = words.length ? words.map(() => '(LOWER(m.title) LIKE ?)').join(' + ') : '0';
        const wordMatch = words.length ? words.map(() => 'LOWER(m.title) LIKE ?').join(' OR ') : 'FALSE';
        const wordParams = words.map(w => `%${like(w)}%`);

        const results = await query(
            `SELECT m.uuid, m.title, m.reference_number, ${CREATOR_NAME} as creator_name,
                    (CASE
                        WHEN LOWER(m.title) = LOWER(?) THEN 1000
                        WHEN LOWER(m.title) LIKE LOWER(?) THEN 500
                        WHEN LOWER(m.title) LIKE LOWER(?) THEN 250
                        ELSE 0
                     END) + (${wordScore}) * 10 as score
             FROM memos m
             JOIN memo_system_users u ON m.created_by = u.id
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE m.status != 'Draft'
               AND (LOWER(m.title) LIKE LOWER(?) OR m.reference_number LIKE ? OR ${wordMatch})
             ORDER BY score DESC, m.created_at DESC
             LIMIT 8`,
            [
                q, `${like(q)}%`, `%${like(q)}%`, ...wordParams,
                `%${like(q)}%`, `%${like(q)}%`, ...wordParams,
            ]
        );
        return NextResponse.json({ results });
    } catch (error) {
        console.error('Memo reference search failed:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
