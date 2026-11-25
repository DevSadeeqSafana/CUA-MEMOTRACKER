import { query } from '@/lib/db';

// Payment and financial reporting over the Accountant's finance queue.
// One row per memo in memo_finance_processing; payments come from memo_finance_payments.
// Money is summed in kobo (integers) so totals never pick up rounding errors.

export const FINANCE_STATUSES = ['Pending Processing', 'In Progress', 'Partially Paid', 'Processed', 'Rejected'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canViewFinanceReports(session: any) {
    const roles: string[] = session?.user?.role || [];
    return roles.includes('Accountant') || roles.includes('Administrator') || roles.includes('VC')
        || String(session?.user?.email || '').toLowerCase().includes('chidi.ojiako');
}

export interface FinanceReportFilters {
    from?: string;      // YYYY-MM-DD, memos routed to the Accountant on/after this day
    to?: string;        // YYYY-MM-DD, memos routed on/before this day
    status?: string;    // one of FINANCE_STATUSES
    category?: string;  // budget category
    vendorId?: number;  // registered vendor (Finance's choice, else the memo's vendor)
    createdBy?: number; // only memos raised by this user (staff dashboard)
}

export interface FinanceObligation {
    processingId: number;
    uuid: string;
    reference: string | null;
    title: string;
    department: string | null;
    category: string;
    payee: string | null;
    vendorId: number | null;
    status: string;
    expected: number;   // naira
    paid: number;
    balance: number;
    paymentCount: number;
    routedAt: string;
    daysSinceRouted: number;
}

export interface FinanceBreakdownRow {
    label: string;
    memos: number;
    expected: number;
    paid: number;
    outstanding: number;
}

export interface FinanceVendorRow extends FinanceBreakdownRow {
    vendorId: number | null;
}

export interface FinanceReport {
    filters: Required<Omit<FinanceReportFilters, 'vendorId' | 'createdBy'>> & Pick<FinanceReportFilters, 'vendorId' | 'createdBy'>;
    categories: string[];
    kpis: {
        totalExpected: number;
        totalPaid: number;
        outstanding: number;
        paymentCount: number;
        memosInQueue: number;
        fullyPaid: number;
        partiallyPaid: number;
        pending: number;
        inProgress: number;
        rejected: number;
        rejectedAmount: number;
        averagePayment: number;
        completionPercent: number;
        paidPercent: number;
        memosWithoutAmount: number;
        oldestUnpaidDays: number | null;
    };
    byStatus: FinanceBreakdownRow[];
    byCategory: FinanceBreakdownRow[];
    byDepartment: FinanceBreakdownRow[];
    byVendor: FinanceVendorRow[];
    paymentsByMonth: { month: string; label: string; count: number; amount: number }[];
    topOutstanding: FinanceObligation[];
    obligations: FinanceObligation[];
    recentPayments: {
        id: number;
        paidAt: string;
        voucher: string;
        amount: number;
        note: string | null;
        uuid: string;
        reference: string | null;
        title: string;
        payee: string | null;
    }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const kobo = (v: unknown) => Math.round((Number(v) || 0) * 100);
const naira = (k: number) => k / 100;
const DAY_MS = 86_400_000;

function cleanFilters(f: FinanceReportFilters): FinanceReport['filters'] {
    const posInt = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
    return {
        vendorId: posInt(f.vendorId),
        createdBy: posInt(f.createdBy),
        from: f.from && DATE_RE.test(f.from) ? f.from : '',
        to: f.to && DATE_RE.test(f.to) ? f.to : '',
        status: f.status && (FINANCE_STATUSES as readonly string[]).includes(f.status) ? f.status : '',
        category: (f.category || '').trim().slice(0, 120),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function getFinanceReport(input: FinanceReportFilters = {}): Promise<FinanceReport> {
    const filters = cleanFilters(input);

    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.from) { where.push('fp.created_at >= ?'); params.push(`${filters.from} 00:00:00`); }
    if (filters.to) { where.push('fp.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(filters.to); }
    if (filters.status) { where.push('fp.status = ?'); params.push(filters.status); }
    if (filters.category) {
        where.push(`COALESCE(NULLIF(CASE WHEN bi.budget_category = 'Others' THEN bi.other_category ELSE bi.budget_category END, ''), 'Uncategorised') = ?`);
        params.push(filters.category);
    }
    if (filters.vendorId) { where.push('COALESCE(fp.vendor_id, m.vendor_id) = ?'); params.push(filters.vendorId); }
    if (filters.createdBy) { where.push('m.created_by = ?'); params.push(filters.createdBy); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(`
        SELECT fp.id AS processing_id, fp.status, fp.total_amount, fp.created_at AS routed_at,
               COALESCE(NULLIF(fp.payee_name, ''), v.vendor_name) AS payee_name,
               v.vendor_id, v.vendor_name,
               m.uuid, m.reference_number, m.title, m.department,
               COALESCE(NULLIF(CASE WHEN bi.budget_category = 'Others' THEN bi.other_category ELSE bi.budget_category END, ''), 'Uncategorised') AS category,
               (SELECT SUM(bit.total) FROM memo_budget_items bit WHERE bit.memo_id = m.id) AS budget_total,
               (SELECT COALESCE(SUM(p.amount), 0) FROM memo_finance_payments p WHERE p.processing_id = fp.id) AS paid_amount,
               (SELECT COUNT(*) FROM memo_finance_payments p WHERE p.processing_id = fp.id) AS payment_count
        FROM memo_finance_processing fp
        JOIN memos m ON m.id = fp.memo_id
        LEFT JOIN memo_budget_info bi ON bi.memo_id = m.id
        LEFT JOIN inventory_vendor v ON v.vendor_id = COALESCE(fp.vendor_id, m.vendor_id)
        ${whereSql}
        ORDER BY fp.created_at ASC
    `, params) as Row[];

    const categoryRows = await query(`
        SELECT DISTINCT COALESCE(NULLIF(CASE WHEN bi.budget_category = 'Others' THEN bi.other_category ELSE bi.budget_category END, ''), 'Uncategorised') AS category
        FROM memo_finance_processing fp
        LEFT JOIN memo_budget_info bi ON bi.memo_id = fp.memo_id
        ORDER BY category ASC
    `) as Row[];

    const now = Date.now();
    const processingIds: number[] = [];

    type Acc = { memos: number; expected: number; paid: number; outstanding: number };
    const blank = (): Acc => ({ memos: 0, expected: 0, paid: 0, outstanding: 0 });
    const byStatus = new Map<string, Acc>(FINANCE_STATUSES.map(s => [s, blank()]));
    const byCategory = new Map<string, Acc>();
    const byDepartment = new Map<string, Acc>();
    const byVendor = new Map<string, Acc & { vendorId: number | null; label: string }>();
    const add = (map: Map<string, Acc>, key: string, e: number, p: number, o: number) => {
        const a = map.get(key) ?? blank();
        a.memos += 1; a.expected += e; a.paid += p; a.outstanding += o;
        map.set(key, a);
    };

    let expectedK = 0, paidK = 0, outstandingK = 0, rejectedK = 0, paymentCount = 0;
    let memosWithoutAmount = 0;
    let oldestUnpaidDays: number | null = null;
    const counts = { fullyPaid: 0, partiallyPaid: 0, pending: 0, inProgress: 0, rejected: 0 };
    const obligations: FinanceObligation[] = [];

    for (const r of rows) {
        processingIds.push(r.processing_id);
        const hasAmount = r.total_amount !== null || r.budget_total !== null;
        const e = kobo(r.total_amount ?? r.budget_total);
        const p = kobo(r.paid_amount);
        const isRejected = r.status === 'Rejected';
        // A memo marked Processed is settled even when payments were not itemised
        const o = isRejected || r.status === 'Processed' ? 0 : Math.max(e - p, 0);
        const days = Math.max(0, Math.floor((now - new Date(r.routed_at).getTime()) / DAY_MS));

        paymentCount += Number(r.payment_count) || 0;
        paidK += p;
        if (isRejected) {
            counts.rejected += 1;
            rejectedK += e;
        } else {
            expectedK += e;
            outstandingK += o;
            if (!hasAmount) memosWithoutAmount += 1;
            if (r.status === 'Processed') counts.fullyPaid += 1;
            else if (r.status === 'Partially Paid') counts.partiallyPaid += 1;
            else if (r.status === 'In Progress') counts.inProgress += 1;
            else counts.pending += 1;
            if (o > 0 && (oldestUnpaidDays === null || days > oldestUnpaidDays)) oldestUnpaidDays = days;
            add(byCategory, r.category, e, p, o);
            add(byDepartment, r.department || 'Unspecified', e, p, o);
            const vKey = r.vendor_id ? `v${r.vendor_id}` : 'none';
            const va = byVendor.get(vKey) ?? { ...blank(), vendorId: r.vendor_id ? Number(r.vendor_id) : null, label: r.vendor_name || 'No registered vendor' };
            va.memos += 1; va.expected += e; va.paid += p; va.outstanding += o;
            byVendor.set(vKey, va);
        }
        add(byStatus, r.status || 'Pending Processing', isRejected ? 0 : e, p, o);

        obligations.push({
            processingId: r.processing_id,
            uuid: r.uuid,
            reference: r.reference_number,
            title: r.title,
            department: r.department,
            category: r.category,
            payee: r.payee_name,
            vendorId: r.vendor_id ? Number(r.vendor_id) : null,
            status: r.status,
            expected: naira(e),
            paid: naira(p),
            balance: naira(o),
            paymentCount: Number(r.payment_count) || 0,
            routedAt: new Date(r.routed_at).toISOString(),
            daysSinceRouted: days,
        });
    }

    // Payments made against the filtered memos, by month, for the last 12 months
    const monthKeys: string[] = [];
    const d0 = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    let monthRows: Row[] = [];
    let recentRows: Row[] = [];
    if (processingIds.length > 0) {
        const placeholders = processingIds.map(() => '?').join(',');
        monthRows = await query(`
            SELECT DATE_FORMAT(p.paid_at, '%Y-%m') AS ym, COUNT(*) AS n, SUM(p.amount) AS total
            FROM memo_finance_payments p
            WHERE p.processing_id IN (${placeholders}) AND p.paid_at >= ?
            GROUP BY ym
        `, [...processingIds, `${monthKeys[0]}-01 00:00:00`]) as Row[];
        recentRows = await query(`
            SELECT p.id, p.paid_at, p.voucher_number, p.amount, p.payment_note,
                   m.uuid, m.reference_number, m.title,
                   COALESCE(NULLIF(fp.payee_name, ''), v.vendor_name) AS payee_name
            FROM memo_finance_payments p
            JOIN memo_finance_processing fp ON fp.id = p.processing_id
            JOIN memos m ON m.id = fp.memo_id
            LEFT JOIN inventory_vendor v ON v.vendor_id = COALESCE(fp.vendor_id, m.vendor_id)
            WHERE p.processing_id IN (${placeholders})
            ORDER BY p.paid_at DESC, p.id DESC
            LIMIT 20
        `, processingIds) as Row[];
    }
    const monthMap = new Map(monthRows.map(m => [m.ym, m]));
    const paymentsByMonth = monthKeys.map(key => {
        const m = monthMap.get(key);
        const [y, mo] = key.split('-').map(Number);
        return {
            month: key,
            label: new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
            count: Number(m?.n) || 0,
            amount: naira(kobo(m?.total)),
        };
    });

    const toRows = (map: Map<string, Acc>): FinanceBreakdownRow[] =>
        Array.from(map.entries())
            .map(([label, a]) => ({ label, memos: a.memos, expected: naira(a.expected), paid: naira(a.paid), outstanding: naira(a.outstanding) }));

    const openObligations = obligations
        .filter(o => o.balance > 0)
        .sort((a, b) => b.balance - a.balance || b.daysSinceRouted - a.daysSinceRouted);

    return {
        filters,
        categories: categoryRows.map(c => c.category),
        kpis: {
            totalExpected: naira(expectedK),
            totalPaid: naira(paidK),
            outstanding: naira(outstandingK),
            paymentCount,
            memosInQueue: rows.length,
            ...counts,
            rejectedAmount: naira(rejectedK),
            averagePayment: paymentCount > 0 ? naira(Math.round(paidK / paymentCount)) : 0,
            completionPercent: expectedK > 0 ? Math.min(100, Math.round(((expectedK - outstandingK) / expectedK) * 1000) / 10) : 0,
            paidPercent: expectedK > 0 ? Math.min(100, Math.round((paidK / expectedK) * 1000) / 10) : 0,
            memosWithoutAmount,
            oldestUnpaidDays,
        },
        byStatus: toRows(byStatus).filter(r => r.memos > 0),
        byCategory: toRows(byCategory).sort((a, b) => b.expected - a.expected),
        byDepartment: toRows(byDepartment).sort((a, b) => b.expected - a.expected),
        byVendor: Array.from(byVendor.values())
            .map(a => ({ vendorId: a.vendorId, label: a.label, memos: a.memos, expected: naira(a.expected), paid: naira(a.paid), outstanding: naira(a.outstanding) }))
            .sort((a, b) => (a.vendorId === null ? 1 : 0) - (b.vendorId === null ? 1 : 0) || b.expected - a.expected),
        paymentsByMonth,
        topOutstanding: openObligations.slice(0, 20),
        obligations: [...obligations].sort((a, b) => b.balance - a.balance),
        recentPayments: recentRows.map(p => ({
            id: p.id,
            paidAt: new Date(p.paid_at).toISOString(),
            voucher: p.voucher_number,
            amount: naira(kobo(p.amount)),
            note: p.payment_note,
            uuid: p.uuid,
            reference: p.reference_number,
            title: p.title,
            payee: p.payee_name,
        })),
    };
}
