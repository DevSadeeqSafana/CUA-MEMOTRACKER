import { auth } from '@/auth';
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { canViewFinanceReports } from '@/lib/finance-report';
import { memoPreview } from '@/lib/memo-preview';

// Search bar in the top navigation: one query across the whole system.
// Every group only returns what the signed-in user may open:
// - pages: navigation the user's roles allow
// - memos: memos the user created, received, approves, was consulted on or replied on
//   (Finance also: memos in the finance queue; Administrators: every sent memo, as in Reports)
// - people: active staff (link to the User Directory for administrators)
// - vendors: the shared Staff Portal vendor list
// - payments: Payment Voucher numbers and payees (Finance, the VC and administrators)

type SearchKind = 'page' | 'memo' | 'person' | 'vendor' | 'payment';
interface SearchHit {
    kind: SearchKind;
    id: string;
    title: string;
    subtitle?: string;
    href: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const PERSON_NAME = (alias: string, user: string) =>
    `COALESCE(CONCAT(${alias}.FirstName, ' ', IFNULL(CONCAT(${alias}.MiddleName, ' '), ''), ${alias}.Surname), ${user}.username)`;

const PAGES: { title: string; href: string; keywords: string; roles?: string[] }[] = [
    { title: 'Compose memo', href: '/dashboard/memos/new', keywords: 'new write create send memo budget requisition' },
    { title: 'Overview', href: '/dashboard', keywords: 'dashboard home summary invoices payments balances' },
    { title: 'Inbox', href: '/dashboard/tasks?folder=inbox', keywords: 'received memos messages replies' },
    { title: 'Important', href: '/dashboard/tasks?folder=important', keywords: 'starred urgent high priority' },
    { title: 'Action Queue', href: '/dashboard/tasks?folder=actions', keywords: 'approve approvals pending decisions review' },
    { title: 'My Decisions', href: '/dashboard/tasks?folder=decided', keywords: 'approved rejected history' },
    { title: 'Sent Memos', href: '/dashboard/tasks?folder=sent', keywords: 'outbox sent' },
    { title: 'Drafts', href: '/dashboard/tasks?folder=drafts', keywords: 'unsent saved draft' },
    { title: 'Vendors', href: '/dashboard/vendors', keywords: 'vendor suppliers companies payees contractors' },
    { title: 'Settings', href: '/dashboard/settings', keywords: 'password profile account approvers preferences' },
    { title: 'Finance Queue', href: '/dashboard/accountant', keywords: 'accountant payments processing vouchers pay', roles: ['Accountant', 'Administrator'] },
    { title: 'Finance Reports', href: '/dashboard/finance-reports', keywords: 'payments paid outstanding expected invoices report', roles: ['Accountant', 'Administrator', 'VC'] },
    { title: 'User Directory', href: '/dashboard/users', keywords: 'users staff accounts people line manager', roles: ['Administrator'] },
    { title: 'Analytics & Reports', href: '/dashboard/reports', keywords: 'analytics statistics reports export', roles: ['Administrator'] },
];

const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [] });

    const userId = Number(session.user.id);
    const roles: string[] = (session.user as { role?: string[] }).role || [];
    const isAdmin = roles.includes('Administrator');
    const seesFinance = canViewFinanceReports(session);
    const lower = q.toLowerCase();
    const like = `%${escapeLike(q)}%`;
    const starts = `${escapeLike(q)}%`;

    const pages: SearchHit[] = PAGES
        .filter(p => !p.roles || p.roles.some(r => roles.includes(r)))
        .filter(p => p.title.toLowerCase().includes(lower) || p.keywords.split(' ').some(k => k.startsWith(lower)))
        .slice(0, 4)
        .map(p => ({ kind: 'page', id: p.href, title: p.title, subtitle: 'Go to page', href: p.href }));

    try {
        const [memoRows, personRows, vendorRows, paymentRows] = await Promise.all([
            query(`
                SELECT m.id, m.uuid, m.title, m.reference_number, m.status, m.department, m.content, m.created_at,
                       ${PERSON_NAME('hs', 'u')} AS creator_name,
                       (m.title LIKE ?) AS title_starts, (m.title LIKE ?) AS title_has, (m.reference_number LIKE ?) AS ref_has
                FROM memos m
                JOIN memo_system_users u ON u.id = m.created_by
                LEFT JOIN hr_staff hs ON hs.StaffID = u.staff_id
                WHERE (m.title LIKE ? OR m.reference_number LIKE ? OR m.content LIKE ? OR m.department LIKE ? OR m.category LIKE ?
                       OR ${PERSON_NAME('hs', 'u')} LIKE ?)
                  AND (m.status <> 'Draft' OR m.created_by = ?)
                  AND (m.created_by = ? OR ?
                       OR EXISTS (SELECT 1 FROM memo_recipients r WHERE r.memo_id = m.id AND r.recipient_id = ?)
                       OR EXISTS (SELECT 1 FROM memo_approvals a WHERE a.memo_id = m.id AND a.approver_id = ?)
                       OR EXISTS (SELECT 1 FROM memo_consultations c WHERE c.memo_id = m.id AND (c.from_user_id = ? OR c.to_user_id = ?))
                       OR EXISTS (SELECT 1 FROM memo_replies rp LEFT JOIN memo_reply_recipients rr ON rr.reply_id = rp.id
                                   WHERE rp.memo_id = m.id AND (rp.author_id = ? OR rr.user_id = ?))
                       OR (? AND EXISTS (SELECT 1 FROM memo_finance_processing fp WHERE fp.memo_id = m.id)))
                ORDER BY title_starts DESC, ref_has DESC, title_has DESC, m.created_at DESC
                LIMIT 8
            `, [starts, like, like, like, like, like, like, like, like, userId, userId, isAdmin ? 1 : 0, userId, userId, userId, userId, userId, userId, seesFinance ? 1 : 0]) as Promise<Row[]>,
            query(`
                SELECT u.id, u.email, u.department, u.staff_id, ${PERSON_NAME('hs', 'u')} AS name, hd.DesignationName AS designation
                FROM memo_system_users u
                LEFT JOIN hr_staff hs ON hs.StaffID = u.staff_id
                LEFT JOIN hr_designation hd ON hd.EntryID = hs.DesignationID
                WHERE u.is_active = 1
                  AND (${PERSON_NAME('hs', 'u')} LIKE ? OR u.email LIKE ? OR u.staff_id LIKE ? OR u.department LIKE ?)
                ORDER BY (${PERSON_NAME('hs', 'u')} LIKE ?) DESC, name ASC
                LIMIT 5
            `, [like, like, like, like, starts]) as Promise<Row[]>,
            query(`
                SELECT v.vendor_id, v.vendor_name, v.email_address, v.phone_number
                FROM inventory_vendor v
                WHERE v.is_active = 1 AND (v.vendor_name LIKE ? OR v.email_address LIKE ? OR v.phone_number LIKE ? OR v.description LIKE ?)
                ORDER BY (v.vendor_name LIKE ?) DESC, v.vendor_name ASC
                LIMIT 5
            `, [like, like, like, like, starts]) as Promise<Row[]>,
            seesFinance
                ? query(`
                    SELECT p.id, p.voucher_number, p.amount, p.paid_at, m.uuid, m.title,
                           COALESCE(NULLIF(fp.payee_name, ''), v.vendor_name) AS payee
                    FROM memo_finance_payments p
                    JOIN memo_finance_processing fp ON fp.id = p.processing_id
                    JOIN memos m ON m.id = fp.memo_id
                    LEFT JOIN inventory_vendor v ON v.vendor_id = COALESCE(fp.vendor_id, m.vendor_id)
                    WHERE p.voucher_number LIKE ? OR fp.payee_name LIKE ? OR v.vendor_name LIKE ?
                    ORDER BY p.paid_at DESC
                    LIMIT 5
                `, [like, like, like]) as Promise<Row[]>
                : Promise.resolve([] as Row[]),
        ]);

        const naira = (v: unknown) => `₦${(Number(v) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const results: SearchHit[] = [
            ...pages,
            ...memoRows.map((m): SearchHit => ({
                kind: 'memo',
                id: `memo-${m.id}`,
                title: m.title,
                subtitle: [m.reference_number, m.creator_name, m.status].filter(Boolean).join(' · ')
                    // Matched in the body only: show where, so the hit makes sense
                    + (!m.title_has && !m.ref_has && String(m.content || '').toLowerCase().includes(lower) ? ` — ${memoPreview(m.content, 70)}` : ''),
                href: m.status === 'Draft' ? `/dashboard/memos/${m.uuid}/edit` : `/dashboard/memos/${m.uuid}`,
            })),
            ...personRows.map((p): SearchHit => ({
                kind: 'person',
                id: `person-${p.id}`,
                title: p.name,
                subtitle: [p.designation, p.department, p.email].filter(Boolean).join(' · '),
                href: isAdmin ? `/dashboard/users?q=${encodeURIComponent(p.email || p.name)}` : `mailto:${p.email}`,
            })),
            ...vendorRows.map((v): SearchHit => ({
                kind: 'vendor',
                id: `vendor-${v.vendor_id}`,
                title: v.vendor_name,
                subtitle: [v.email_address, v.phone_number].filter(Boolean).join(' · ') || 'Registered vendor',
                href: seesFinance ? `/dashboard/vendors/${v.vendor_id}` : `/dashboard/vendors?q=${encodeURIComponent(v.vendor_name)}`,
            })),
            ...paymentRows.map((p): SearchHit => ({
                kind: 'payment',
                id: `payment-${p.id}`,
                title: `${p.voucher_number} · ${naira(p.amount)}`,
                subtitle: [p.payee, p.title].filter(Boolean).join(' · '),
                href: `/dashboard/memos/${p.uuid}`,
            })),
        ];

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Search API Error:', error);
        // Pages still work if the database is unavailable
        return NextResponse.json({ results: pages, error: 'Some results could not be loaded.' });
    }
}
