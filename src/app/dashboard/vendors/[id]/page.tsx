export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { AlertCircle, Building2, Mail, Phone, MapPin, Landmark, ChevronLeft } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { listVendorRecords, canManageVendors } from '@/lib/vendor-data';
import { canViewFinanceReports, getFinanceReport } from '@/lib/finance-report';

const formatNGN = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap';
const td = 'px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap';

const statusBadge = (status: string) => cn(
    'text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest whitespace-nowrap',
    status === 'Processed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : status === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-700'
        : status === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700'
        : status === 'Partially Paid' ? 'bg-violet-50 border-violet-200 text-violet-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
);

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return null;
    if (!canViewFinanceReports(session)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm text-center px-6">
                <AlertCircle size={40} className="text-rose-500 mb-4" />
                <h2 className="text-xl font-bold text-[#0b2a5b]">Access Restricted</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-md">Vendor payment details are available to Finance, the Vice-Chancellor and administrators.</p>
                <Link href="/dashboard/vendors" className="mt-5 text-xs font-black uppercase tracking-widest text-[#1a5aa6] hover:underline">Back to vendors</Link>
            </div>
        );
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const [[vendor], report] = await Promise.all([
        listVendorRecords({ status: 'all', id }),
        getFinanceReport({ vendorId: id }),
    ]);
    if (!vendor) notFound();
    const { kpis } = report;
    const showBank = canManageVendors(session);

    const tiles = [
        { label: 'Invoice amount', value: formatNGN(kpis.totalExpected), tone: 'text-[#0b2a5b]' },
        { label: 'Amount paid', value: formatNGN(kpis.totalPaid), tone: 'text-emerald-700' },
        { label: 'Outstanding', value: formatNGN(kpis.outstanding), tone: 'text-violet-700' },
        { label: 'Payments made', value: String(kpis.paymentCount), tone: 'text-[#0b2a5b]' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 font-sans">
            <Link href="/dashboard/vendors" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0b2a5b]">
                <ChevronLeft size={14} /> All vendors
            </Link>

            <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-xl flex flex-col md:flex-row md:items-start gap-5">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 bg-[#0b2a5b] text-white flex items-center justify-center shrink-0 rounded-full ring-2 ring-[#e3ac3a]/70 ring-offset-2">
                        <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-3xl font-medium tracking-tight text-[#0b2a5b] font-display break-words">
                            {vendor.name}
                            {!vendor.isActive && <span className="ml-3 align-middle rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Deactivated</span>}
                        </h1>
                        {vendor.description && <p className="text-xs text-slate-500 font-medium">{vendor.description}</p>}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-medium text-slate-600 md:max-w-md">
                    {vendor.email && <p className="flex items-center gap-2 break-all"><Mail size={12} className="text-slate-300 shrink-0" />{vendor.email}</p>}
                    {vendor.phone && <p className="flex items-center gap-2"><Phone size={12} className="text-slate-300" />{vendor.phone}</p>}
                    {vendor.address && <p className="flex items-start gap-2 sm:col-span-2"><MapPin size={12} className="mt-0.5 text-slate-300 shrink-0" />{vendor.address}</p>}
                    {showBank && vendor.accountNumber && (
                        <p className="flex items-start gap-2 sm:col-span-2"><Landmark size={12} className="mt-0.5 text-slate-300 shrink-0" />{vendor.bankName} · {vendor.accountNumber}{vendor.accountName ? ` · ${vendor.accountName}` : ''}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tiles.map(t => (
                    <div key={t.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.label}</p>
                        <p className={cn('mt-1 text-lg md:text-xl font-black tracking-tight truncate', t.tone)}>{t.value}</p>
                    </div>
                ))}
            </div>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-black text-[#0b2a5b]">Memos in the finance queue</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{vendor.memoCount} memo(s) name this vendor; {report.obligations.length} reached Finance.</p>
                </div>
                {report.obligations.length === 0 ? (
                    <p className="px-5 py-10 text-center text-xs text-slate-400 font-medium">No memo for this vendor has reached Finance yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Memo</th>
                                    <th className={th}>Status</th>
                                    <th className={cn(th, 'text-right')}>Invoice</th>
                                    <th className={cn(th, 'text-right')}>Paid</th>
                                    <th className={cn(th, 'text-right')}>Balance</th>
                                    <th className={th}>Sent to Finance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.obligations.map(o => (
                                    <tr key={o.processingId}>
                                        <td className={cn(td, 'whitespace-normal min-w-[14rem]')}>
                                            <Link href={`/dashboard/memos/${o.uuid}`} className="text-[#0b2a5b] hover:underline">{o.title}</Link>
                                            {o.reference && <p className="text-[10px] font-semibold text-slate-400">{o.reference}</p>}
                                        </td>
                                        <td className={td}><span className={statusBadge(o.status)}>{o.status}</span></td>
                                        <td className={cn(td, 'text-right')}>{formatNGN(o.expected)}</td>
                                        <td className={cn(td, 'text-right text-emerald-700')}>{formatNGN(o.paid)}</td>
                                        <td className={cn(td, 'text-right', o.balance > 0 ? 'text-violet-700' : 'text-slate-300')}>{formatNGN(o.balance)}</td>
                                        <td className={cn(td, 'text-slate-500')}>{formatDate(o.routedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {report.recentPayments.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h2 className="text-sm font-black text-[#0b2a5b]">Recent payments</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Date</th>
                                    <th className={th}>Voucher</th>
                                    <th className={th}>Memo</th>
                                    <th className={cn(th, 'text-right')}>Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.recentPayments.map(p => (
                                    <tr key={p.id}>
                                        <td className={cn(td, 'text-slate-500')}>{formatDate(p.paidAt)}</td>
                                        <td className={td}>{p.voucher}</td>
                                        <td className={cn(td, 'whitespace-normal')}><Link href={`/dashboard/memos/${p.uuid}`} className="text-[#0b2a5b] hover:underline">{p.title}</Link></td>
                                        <td className={cn(td, 'text-right text-emerald-700')}>{formatNGN(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
