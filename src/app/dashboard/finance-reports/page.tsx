export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { auth } from '@/auth';
import { AlertCircle, Landmark, Wallet, CheckCircle2, Clock, Receipt, Hourglass, Filter } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { canViewFinanceReports, getFinanceReport, FINANCE_STATUSES, type FinanceBreakdownRow } from '@/lib/finance-report';
import FinanceExportButton from '@/components/reports/FinanceExportButton';

export const metadata = {
    title: 'Finance Reports | CUA Memo System',
    description: 'Payments made, amounts expected and outstanding obligations on finance memos',
};

const formatNGN = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (status: string) => cn(
    'text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest whitespace-nowrap',
    status === 'Processed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : status === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-700'
        : status === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700'
        : status === 'Partially Paid' ? 'bg-violet-50 border-violet-200 text-violet-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
);

const th = 'px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap';
const td = 'px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap';

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-black text-[#0b2a5b]">{title}</h2>
                    {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function BreakdownTable({ rows, labelHeading, empty }: { rows: FinanceBreakdownRow[]; labelHeading: string; empty: string }) {
    if (rows.length === 0) return <p className="px-5 py-8 text-center text-xs text-slate-400 font-medium">{empty}</p>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/60">
                    <tr>
                        <th className={th}>{labelHeading}</th>
                        <th className={cn(th, 'text-center')}>Memos</th>
                        <th className={cn(th, 'text-right')}>Expected</th>
                        <th className={cn(th, 'text-right')}>Paid</th>
                        <th className={cn(th, 'text-right')}>Outstanding</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(r => (
                        <tr key={r.label}>
                            <td className={cn(td, 'whitespace-normal min-w-[9rem]')}>{r.label}</td>
                            <td className={cn(td, 'text-center')}>{r.memos}</td>
                            <td className={cn(td, 'text-right')}>{formatNGN(r.expected)}</td>
                            <td className={cn(td, 'text-right text-emerald-700')}>{formatNGN(r.paid)}</td>
                            <td className={cn(td, 'text-right text-violet-700')}>{formatNGN(r.outstanding)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default async function FinanceReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; status?: string; category?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return null;

    if (!canViewFinanceReports(session)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-2xl shadow-sm text-center px-6">
                <AlertCircle size={48} className="text-destructive mb-4" />
                <h2 className="text-xl font-bold">Access Restricted</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Finance reports are available to the Accountant, the Vice-Chancellor and administrators.
                    Please contact your IT department if you believe this is an error.
                </p>
            </div>
        );
    }

    const report = await getFinanceReport(await searchParams);
    const { kpis, filters } = report;
    const isFiltered = Boolean(filters.from || filters.to || filters.status || filters.category);
    const maxMonth = Math.max(0, ...report.paymentsByMonth.map(m => m.amount));

    const kpiCards = [
        { label: 'Total Expected', value: formatNGN(kpis.totalExpected), note: `Across ${kpis.memosInQueue - kpis.rejected} active memo(s)`, icon: Landmark, tone: 'navy' },
        { label: 'Total Paid', value: formatNGN(kpis.totalPaid), note: `${kpis.paymentCount} payment(s) recorded`, icon: CheckCircle2, tone: 'emerald' },
        { label: 'Outstanding Balance', value: formatNGN(kpis.outstanding), note: 'Still owed on open memos', icon: Wallet, tone: 'violet' },
        { label: 'Settled', value: `${kpis.completionPercent}%`, note: 'Of expected: paid, or marked Processed', icon: Clock, tone: 'gold' },
    ] as const;

    const statCards = [
        { label: 'Memos in queue', value: kpis.memosInQueue },
        { label: 'Fully paid', value: kpis.fullyPaid },
        { label: 'Partially paid', value: kpis.partiallyPaid },
        { label: 'In progress', value: kpis.inProgress },
        { label: 'Pending', value: kpis.pending },
        { label: 'Rejected', value: kpis.rejected },
        { label: 'Payments made', value: kpis.paymentCount },
        { label: 'Paid vs expected', value: `${kpis.paidPercent}%` },
        { label: 'Average payment', value: formatNGN(kpis.averagePayment) },
        { label: 'Oldest unpaid', value: kpis.oldestUnpaidDays === null ? '—' : `${kpis.oldestUnpaidDays} day(s)` },
        { label: 'Rejected amount', value: formatNGN(kpis.rejectedAmount) },
        { label: 'Memos with no amount', value: kpis.memosWithoutAmount },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 font-sans">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 bg-[#0b2a5b] text-white flex items-center justify-center shrink-0 rounded-full ring-2 ring-[#e3ac3a]/70 ring-offset-2">
                        <Receipt size={18} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-3xl font-medium tracking-tight text-[#0b2a5b] font-display">Payments &amp; Financial Report</h1>
                        <p className="text-xs text-slate-500 font-medium">Payments made, amounts expected and outstanding obligations on finance memos.</p>
                    </div>
                </div>
                <FinanceExportButton rows={report.obligations} />
            </div>

            {/* Filters */}
            <form method="GET" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <label className="space-y-1 min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Sent to Accountant from</span>
                    <input type="date" name="from" defaultValue={filters.from} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" />
                </label>
                <label className="space-y-1 min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">To</span>
                    <input type="date" name="to" defaultValue={filters.to} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" />
                </label>
                <label className="space-y-1 min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
                    <select name="status" defaultValue={filters.status} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none">
                        <option value="">All statuses</option>
                        {FINANCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <label className="space-y-1 min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Budget category</span>
                    <select name="category" defaultValue={filters.category} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none">
                        <option value="">All categories</option>
                        {report.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </label>
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0b2a5b] hover:bg-[#1a5aa6] text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                        <Filter size={12} /> Apply
                    </button>
                    {isFiltered && (
                        <Link href="/dashboard/finance-reports" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors text-center">
                            Clear
                        </Link>
                    )}
                </div>
            </form>

            {/* Headline KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                    <div
                        key={card.label}
                        className={cn(
                            'rounded-2xl border p-5 shadow-sm min-w-0',
                            card.tone === 'navy' && 'bg-[#0b2a5b] border-blue-900 text-white',
                            card.tone === 'emerald' && 'bg-emerald-50 border-emerald-200',
                            card.tone === 'violet' && 'bg-violet-50 border-violet-200',
                            card.tone === 'gold' && 'bg-amber-50 border-[#e3ac3a]/50',
                        )}
                    >
                        <div className={cn(
                            'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
                            card.tone === 'navy' && 'text-blue-200',
                            card.tone === 'emerald' && 'text-emerald-700',
                            card.tone === 'violet' && 'text-violet-700',
                            card.tone === 'gold' && 'text-amber-700',
                        )}>
                            <card.icon size={14} />
                            {card.label}
                        </div>
                        <p className={cn('text-xl md:text-2xl font-black mt-2 break-all', card.tone === 'navy' ? 'text-white' : 'text-slate-900')}>{card.value}</p>
                        <p className={cn('text-[11px] font-medium mt-1', card.tone === 'navy' ? 'text-blue-100/70' : 'text-slate-500')}>{card.note}</p>
                    </div>
                ))}
            </div>

            {/* Secondary statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map(s => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                        <p className="text-sm md:text-base font-black text-[#0b2a5b] mt-1 break-all">{s.value}</p>
                    </div>
                ))}
            </div>

            {kpis.memosWithoutAmount > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-amber-900">
                        {kpis.memosWithoutAmount} memo(s) have no total amount and no budget items, so they count as ₦0.00 expected.
                        The Accountant can set the total owed on each memo in the Finance Queue.
                    </p>
                </div>
            )}

            {/* Status + payments by month */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <SectionCard title="By Processing Status" subtitle="Rejected memos are not counted as expected or outstanding">
                    <BreakdownTable rows={report.byStatus} labelHeading="Status" empty="No finance memos match these filters." />
                </SectionCard>
                <SectionCard title="Payments by Month" subtitle="Last 12 months, by payment date">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Month</th>
                                    <th className={cn(th, 'text-center')}>Payments</th>
                                    <th className={cn(th, 'text-right')}>Amount</th>
                                    <th className={cn(th, 'w-1/3 hidden sm:table-cell')}><span className="sr-only">Share</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.paymentsByMonth.map(m => (
                                    <tr key={m.month}>
                                        <td className={td}>{m.label}</td>
                                        <td className={cn(td, 'text-center')}>{m.count}</td>
                                        <td className={cn(td, 'text-right', m.amount > 0 ? 'text-emerald-700' : 'text-slate-300')}>{formatNGN(m.amount)}</td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${maxMonth > 0 ? (m.amount / maxMonth) * 100 : 0}%` }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>

            {/* Category + department */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <SectionCard title="By Budget Category">
                    <BreakdownTable rows={report.byCategory} labelHeading="Category" empty="No active finance memos." />
                </SectionCard>
                <SectionCard title="By Department">
                    <BreakdownTable rows={report.byDepartment} labelHeading="Department" empty="No active finance memos." />
                </SectionCard>
            </div>

            {/* Outstanding obligations */}
            <SectionCard
                title="Outstanding Obligations"
                subtitle={`Largest balances first${report.topOutstanding.length === 20 ? ' (top 20; export for the full list)' : ''}`}
            >
                {report.topOutstanding.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-slate-400 font-medium">Nothing is outstanding for these filters.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Memo</th>
                                    <th className={th}>Payee</th>
                                    <th className={th}>Status</th>
                                    <th className={cn(th, 'text-right')}>Expected</th>
                                    <th className={cn(th, 'text-right')}>Paid</th>
                                    <th className={cn(th, 'text-right')}>Balance</th>
                                    <th className={cn(th, 'text-right')}>In queue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.topOutstanding.map(o => (
                                    <tr key={o.processingId} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 min-w-[14rem]">
                                            <Link href={`/dashboard/memos/${o.uuid}`} className="text-xs font-black text-[#0b2a5b] hover:text-[#1a5aa6] hover:underline break-words">{o.title}</Link>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{o.reference || '—'}</p>
                                        </td>
                                        <td className={cn(td, 'whitespace-normal min-w-[8rem]')}>{o.payee || <span className="text-slate-300">Not set</span>}</td>
                                        <td className="px-4 py-3"><span className={statusBadge(o.status)}>{o.status}</span></td>
                                        <td className={cn(td, 'text-right')}>{formatNGN(o.expected)}</td>
                                        <td className={cn(td, 'text-right text-emerald-700')}>{formatNGN(o.paid)}</td>
                                        <td className={cn(td, 'text-right text-violet-700 font-black')}>{formatNGN(o.balance)}</td>
                                        <td className={cn(td, 'text-right', o.daysSinceRouted > 30 ? 'text-rose-600' : 'text-slate-500')}>
                                            <span className="inline-flex items-center gap-1"><Hourglass size={11} />{o.daysSinceRouted}d</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* Recent payments */}
            <SectionCard title="Recent Payments" subtitle="The 20 most recent payments on these memos">
                {report.recentPayments.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-slate-400 font-medium">No payments have been recorded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Date</th>
                                    <th className={th}>Voucher</th>
                                    <th className={th}>Memo</th>
                                    <th className={th}>Payee</th>
                                    <th className={cn(th, 'text-right')}>Amount</th>
                                    <th className={th}>Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.recentPayments.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/60">
                                        <td className={td}>{formatDate(p.paidAt)}</td>
                                        <td className="px-4 py-3"><span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 whitespace-nowrap">{p.voucher}</span></td>
                                        <td className="px-4 py-3 min-w-[12rem]">
                                            <Link href={`/dashboard/memos/${p.uuid}`} className="text-xs font-black text-[#0b2a5b] hover:text-[#1a5aa6] hover:underline break-words">{p.title}</Link>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.reference || '—'}</p>
                                        </td>
                                        <td className={cn(td, 'whitespace-normal min-w-[8rem]')}>{p.payee || '—'}</td>
                                        <td className={cn(td, 'text-right text-emerald-700 font-black')}>{formatNGN(p.amount)}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500 font-medium min-w-[10rem]">{p.note || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
