import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, FileText, Landmark, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FinanceObligation, FinanceReport, FinanceVendorRow } from '@/lib/finance-report';

const formatNGN = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap';
const td = 'px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap';

interface Props {
    /** university: every memo in the finance queue; mine: the viewer's own memos */
    scope: 'university' | 'mine';
    kpis: FinanceReport['kpis'];
    obligations: FinanceObligation[];
    vendors: FinanceVendorRow[];
}

/** Dashboard panel: invoice amount, amount paid and outstanding balance in one view. */
export default function PaymentsOverview({ scope, kpis, obligations, vendors }: Props) {
    const paidPct = Math.min(100, kpis.paidPercent);
    const figures = [
        { label: 'Invoice amount', value: kpis.totalExpected, note: `${kpis.memosInQueue - kpis.rejected} active memo(s)`, icon: FileText, tone: 'text-[#0b2a5b]', chip: 'bg-blue-50 text-[#1a5aa6]' },
        { label: 'Amount paid', value: kpis.totalPaid, note: `${kpis.paymentCount} payment(s) · ${kpis.paidPercent}% of invoices`, icon: CheckCircle2, tone: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-600' },
        { label: 'Outstanding balance', value: kpis.outstanding, note: kpis.oldestUnpaidDays === null ? 'Nothing owed' : `Oldest unpaid: ${kpis.oldestUnpaidDays} day(s)`, icon: Wallet, tone: 'text-violet-700', chip: 'bg-violet-50 text-violet-600' },
    ];

    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#0b2a5b] text-white flex items-center justify-center shrink-0"><Landmark size={16} /></div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-[#0b2a5b]">Invoices, payments &amp; balances</h2>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {scope === 'university' ? 'All memos in the finance queue' : 'Your memos in the finance queue'}
                        </p>
                    </div>
                </div>
                {scope === 'university' && (
                    <Link href="/dashboard/finance-reports" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#1a5aa6] hover:gap-2.5 transition-all">
                        Full report <ArrowRight size={12} />
                    </Link>
                )}
            </div>

            {/* The three figures side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {figures.map(f => {
                    const Icon = f.icon;
                    return (
                        <div key={f.label} className="p-5 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', f.chip)}><Icon size={14} /></span>
                                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{f.label}</h3>
                            </div>
                            <p className={cn('mt-2 text-xl xl:text-2xl font-black tracking-tight break-words', f.tone)}>{formatNGN(f.value)}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{f.note}</p>
                        </div>
                    );
                })}
            </div>

            {/* Paid vs owed */}
            <div className="px-5 pb-4">
                <div className="h-2.5 rounded-full bg-violet-100 overflow-hidden" role="img" aria-label={`${paidPct}% of the invoice amount has been paid`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[10px] font-bold">
                    <span className="text-emerald-700">{kpis.paidPercent}% paid</span>
                    <span className="text-slate-400">
                        {kpis.fullyPaid} fully paid · {kpis.partiallyPaid} part paid · {kpis.pending + kpis.inProgress} awaiting payment
                    </span>
                </div>
            </div>

            <div className={cn('border-t border-slate-100 grid grid-cols-1', vendors.length > 0 && 'xl:grid-cols-3')}>
                {/* Largest open balances */}
                <div className={cn('min-w-0', vendors.length > 0 && 'xl:col-span-2 xl:border-r border-slate-100')}>
                    <p className="px-5 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Largest outstanding balances</p>
                    {obligations.length === 0 ? (
                        <p className="px-5 pb-5 text-xs font-medium text-slate-400">Nothing is outstanding.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/60">
                                    <tr>
                                        <th className={th}>Memo</th>
                                        <th className={th}>Vendor / payee</th>
                                        <th className={cn(th, 'text-right')}>Invoice</th>
                                        <th className={cn(th, 'text-right')}>Paid</th>
                                        <th className={cn(th, 'text-right')}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {obligations.map(o => (
                                        <tr key={o.processingId}>
                                            <td className={cn(td, 'whitespace-normal min-w-[12rem]')}>
                                                <Link href={`/dashboard/memos/${o.uuid}`} className="text-[#0b2a5b] hover:underline line-clamp-1">{o.title}</Link>
                                                <span className="text-[10px] font-semibold text-slate-400">{o.status}</span>
                                            </td>
                                            <td className={cn(td, 'whitespace-normal text-slate-500 min-w-[8rem]')}>{o.payee || '—'}</td>
                                            <td className={cn(td, 'text-right')}>{formatNGN(o.expected)}</td>
                                            <td className={cn(td, 'text-right text-emerald-700')}>{formatNGN(o.paid)}</td>
                                            <td className={cn(td, 'text-right text-violet-700')}>{formatNGN(o.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Vendors still owed */}
                {vendors.length > 0 && (
                    <div className="min-w-0 border-t xl:border-t-0 border-slate-100">
                        <p className="px-5 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Vendors still owed</p>
                        <ul className="divide-y divide-slate-100">
                            {vendors.map(v => (
                                <li key={v.vendorId}>
                                    <Link href={`/dashboard/vendors/${v.vendorId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Building2 size={13} /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-bold text-slate-700">{v.label}</span>
                                            <span className="block text-[10px] font-semibold text-slate-400">Paid {formatNGN(v.paid)} of {formatNGN(v.expected)}</span>
                                        </span>
                                        <span className="text-xs font-black text-violet-700 whitespace-nowrap">{formatNGN(v.outstanding)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
