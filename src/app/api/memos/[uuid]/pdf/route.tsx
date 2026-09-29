import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import MemoPdf, { MemoPdfData } from '@/lib/pdf/MemoPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DB rows are untyped mysql2 results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const PERSON_NAME = `COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username)`;

/** GET /api/memos/:uuid/pdf: official PDF copy of a memo, for any signed-in user. */
export async function GET(request: Request, { params }: { params: Promise<{ uuid: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uuid } = await params;

    try {
        const memos = await query(
            `SELECT m.*, ${PERSON_NAME} as creator_name, hd.DesignationName as creator_designation,
                    bi.year_id, bi.budget_category, bi.other_category
             FROM memos m
             JOIN memo_system_users u ON m.created_by = u.id
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
             LEFT JOIN memo_budget_info bi ON m.id = bi.memo_id
             WHERE m.uuid = ?`,
            [uuid]
        ) as Row[];
        if (memos.length === 0) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 });
        }
        const memo = memos[0];

        const [recipients, approvals, budgetItems, attachments] = await Promise.all([
            // BCC recipients and the VC are deliberately left off the document
            query(
                `SELECT mr.recipient_type, ${PERSON_NAME} as name, hd.DesignationName as designation, u.department
                 FROM memo_recipients mr
                 JOIN memo_system_users u ON mr.recipient_id = u.id
                 LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                 LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
                 WHERE mr.memo_id = ? AND mr.recipient_type IN ('To', 'CC')
                   AND NOT EXISTS (
                       SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                       WHERE ur.user_id = u.id AND r.name = 'VC'
                   )
                 ORDER BY FIELD(mr.recipient_type, 'To', 'CC'), name ASC`,
                [memo.id]
            ) as Promise<Row[]>,
            query(
                `SELECT a.status, a.processed_at, ${PERSON_NAME} as name, hd.DesignationName as designation, u.department
                 FROM memo_approvals a
                 JOIN memo_system_users u ON a.approver_id = u.id
                 LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                 LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
                 WHERE a.memo_id = ?
                 ORDER BY a.step_order ASC`,
                [memo.id]
            ) as Promise<Row[]>,
            query('SELECT * FROM memo_budget_items WHERE memo_id = ?', [memo.id]) as Promise<Row[]>,
            query('SELECT * FROM attachments WHERE memo_id = ?', [memo.id]) as Promise<Row[]>,
        ]);

        const data: MemoPdfData = {
            title: memo.title,
            referenceNumber: memo.reference_number,
            createdAt: memo.created_at,
            status: memo.status,
            priority: memo.priority,
            memoType: memo.memo_type,
            category: memo.category,
            // Memo references link to the live memo, so make their relative links absolute
            contentHtml: String(memo.content || '').replace(/href="\/dashboard\//g, `href="${new URL(request.url).origin}/dashboard/`),
            from: { name: memo.creator_name, designation: memo.creator_designation, department: memo.department },
            to: recipients.filter(r => r.recipient_type === 'To').map(r => ({ name: r.name, designation: r.designation, department: r.department })),
            cc: recipients.filter(r => r.recipient_type === 'CC').map(r => ({ name: r.name, designation: r.designation, department: r.department })),
            through: approvals.map(a => ({ name: a.name, designation: a.designation, department: a.department, status: a.status, decidedAt: a.processed_at })),
            budget: budgetItems.length > 0 ? {
                year: memo.year_id,
                category: memo.budget_category === 'Others' ? memo.other_category : memo.budget_category,
                items: budgetItems.map(item => {
                    // Descriptions are stored as "[Category] description"
                    const match = String(item.description || '').match(/^\[(.*?)\]\s*(.*)$/);
                    return {
                        category: match ? match[1] : null,
                        description: match ? match[2] : item.description,
                        quantity: item.quantity,
                        amount: parseFloat(item.amount) || 0,
                        total: parseFloat(item.total) || 0,
                    };
                }),
            } : null,
            attachments: attachments.map(a => a.file_name || 'Attachment'),
            generatedBy: session.user.name || session.user.email || 'Staff',
            generatedAt: new Date(),
        };

        const pdf = await renderToBuffer(<MemoPdf memo={data} />);

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, 'DOWNLOAD_MEMO_PDF', 'memos', memo.id, JSON.stringify({ reference: memo.reference_number })]
        ).catch(err => console.error('Failed to audit PDF download:', err));

        const safeName = String(memo.reference_number || memo.title || 'memo').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'memo';
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Memo PDF generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
