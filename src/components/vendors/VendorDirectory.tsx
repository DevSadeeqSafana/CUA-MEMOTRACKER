'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Phone, MapPin, Plus, Pencil, Search, Power, Landmark, ArrowUpRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { setVendorActive } from '@/lib/vendor-actions';
import type { VendorRecord } from '@/lib/vendor-data';
import VendorFormModal from './VendorFormModal';
import { cn, formatDate } from '@/lib/utils';

export interface VendorTotals { memos: number; expected: number; paid: number; outstanding: number }

interface Props {
    vendors: VendorRecord[];
    /** Invoice / paid / outstanding per vendor; null when the viewer may not see finance figures. */
    totals: Record<number, VendorTotals> | null;
    canManage: boolean;
    search: string;
    status: 'active' | 'inactive' | 'all';
}

const formatNGN = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap';

export default function VendorDirectory({ vendors, totals, canManage, search, status }: Props) {
    const router = useRouter();
    const [editing, setEditing] = useState<VendorRecord | null>(null);
    const [creating, setCreating] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const sum = (key: keyof VendorTotals) => vendors.reduce((acc, v) => acc + (totals?.[v.id]?.[key] ?? 0), 0);
    const owing = totals ? vendors.filter(v => (totals[v.id]?.outstanding ?? 0) > 0).length : 0;

    const toggleActive = async (v: VendorRecord) => {
        if (v.isActive && !window.confirm(`Deactivate ${v.name}? It will no longer appear when staff pick a vendor. Existing memos keep it.`)) return;
        setBusyId(v.id);
        const res = await setVendorActive(v.id, !v.isActive);
        setBusyId(null);
        if (!res.success) { toast.error(res.error); return; }
        toast.success(v.isActive ? `${v.name} deactivated` : `${v.name} reactivated`);
        router.refresh();
    };

    const tiles = totals
        ? [
            { label: 'Vendors listed', value: String(vendors.length), tone: 'text-[#0b2a5b]' },
            { label: 'Invoice amount', value: formatNGN(sum('expected')), tone: 'text-[#0b2a5b]' },
            { label: 'Amount paid', value: formatNGN(sum('paid')), tone: 'text-emerald-700' },
            { label: 'Outstanding', value: formatNGN(sum('outstanding')), tone: 'text-violet-700', note: `${owing} vendor(s) still owed` },
        ]
        : [
            { label: 'Vendors listed', value: String(vendors.length), tone: 'text-[#0b2a5b]' },
            { label: 'Linked to memos', value: String(vendors.filter(v => v.memoCount > 0).length), tone: 'text-[#0b2a5b]' },
        ];

    return (
        <div className="space-y-5">
            {/* Summary */}
            <div className={cn('grid gap-3', totals ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>
                {tiles.map(t => (
                    <div key={t.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.label}</p>
                        <p className={cn('mt-1 text-lg md:text-xl font-black tracking-tight truncate', t.tone)}>{t.value}</p>
                        {'note' in t && t.note && <p className="text-[10px] font-semibold text-slate-400">{t.note}</p>}
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <form method="GET" className="relative flex-1 min-w-0">
                    <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                        name="q"
                        defaultValue={search}
                        placeholder="Search by name, email, phone or what they supply…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium shadow-sm outline-none focus:border-[#1a5aa6] focus:ring-4 focus:ring-[#1a5aa6]/10"
                    />
                    {status !== 'active' && <input type="hidden" name="status" value={status} />}
                </form>
                {canManage && (
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
                        {(['active', 'inactive', 'all'] as const).map(s => (
                            <Link
                                key={s}
                                href={`/dashboard/vendors?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(s !== 'active' ? { status: s } : {}) })}`}
                                className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest', status === s ? 'bg-[#0b2a5b] text-white' : 'text-slate-400 hover:text-slate-600')}
                            >
                                {s === 'active' ? 'Active' : s === 'inactive' ? 'Deactivated' : 'All'}
                            </Link>
                        ))}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0b2a5b] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-blue-900/20 hover:bg-[#1a5aa6]"
                >
                    <Plus size={14} /> Register vendor
                </button>
            </div>

            {vendors.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-16 text-center">
                    <Building2 size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-500">{search ? `No vendor matches “${search}”.` : 'No vendors here yet.'}</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/60">
                                <tr>
                                    <th className={th}>Vendor</th>
                                    <th className={th}>Contact</th>
                                    {canManage && <th className={th}>Bank account</th>}
                                    <th className={cn(th, 'text-center')}>Memos</th>
                                    {totals && <>
                                        <th className={cn(th, 'text-right')}>Invoice</th>
                                        <th className={cn(th, 'text-right')}>Paid</th>
                                        <th className={cn(th, 'text-right')}>Outstanding</th>
                                    </>}
                                    <th className={th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {vendors.map(v => {
                                    const t = totals?.[v.id];
                                    return (
                                        <tr key={v.id} className={cn('align-top', !v.isActive && 'bg-slate-50/70')}>
                                            <td className="px-4 py-3.5 min-w-[14rem]">
                                                <div className="flex items-center gap-2">
                                                    {totals ? (
                                                        <Link href={`/dashboard/vendors/${v.id}`} className="text-sm font-bold text-[#0b2a5b] hover:underline">{v.name}</Link>
                                                    ) : <span className="text-sm font-bold text-[#0b2a5b]">{v.name}</span>}
                                                    {!v.isActive && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Deactivated</span>}
                                                </div>
                                                {v.description && <p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-slate-500">{v.description}</p>}
                                                <p className="mt-1 text-[10px] font-medium text-slate-400">
                                                    Added {v.createdAt ? formatDate(v.createdAt) : '—'}{v.createdBy ? ` by ${v.createdBy}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5 text-[11px] font-medium text-slate-600 space-y-0.5 min-w-[12rem]">
                                                {v.email && <p className="flex items-center gap-1.5"><Mail size={11} className="text-slate-300" />{v.email}</p>}
                                                {v.phone && <p className="flex items-center gap-1.5"><Phone size={11} className="text-slate-300" />{v.phone}</p>}
                                                {v.address && <p className="flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0 text-slate-300" /><span className="line-clamp-2">{v.address}</span></p>}
                                                {!v.email && !v.phone && !v.address && <span className="text-slate-300">No contact details</span>}
                                            </td>
                                            {canManage && (
                                                <td className="px-4 py-3.5 text-[11px] font-medium text-slate-600">
                                                    {v.accountNumber ? (
                                                        <>
                                                            <p className="font-bold text-slate-700">{v.bankName || '—'}</p>
                                                            <p>{v.accountNumber}</p>
                                                            {v.accountName && <p className="text-slate-400">{v.accountName}</p>}
                                                        </>
                                                    ) : <span className="text-slate-300">Not recorded</span>}
                                                </td>
                                            )}
                                            <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-700">{v.memoCount}</td>
                                            {totals && <>
                                                <td className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 whitespace-nowrap">{formatNGN(t?.expected ?? 0)}</td>
                                                <td className="px-4 py-3.5 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatNGN(t?.paid ?? 0)}</td>
                                                <td className={cn('px-4 py-3.5 text-right text-xs font-bold whitespace-nowrap', (t?.outstanding ?? 0) > 0 ? 'text-violet-700' : 'text-slate-300')}>{formatNGN(t?.outstanding ?? 0)}</td>
                                            </>}
                                            <td className="px-4 py-3.5">
                                                <RowActions v={v} canManage={canManage} hasDetail={Boolean(totals)} busy={busyId === v.id} onEdit={() => setEditing(v)} onToggle={() => toggleActive(v)} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile / tablet cards */}
                    <ul className="lg:hidden divide-y divide-slate-100">
                        {vendors.map(v => {
                            const t = totals?.[v.id];
                            return (
                                <li key={v.id} className={cn('p-4 space-y-2', !v.isActive && 'bg-slate-50/70')}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-[#0b2a5b] break-words">
                                                {v.name}
                                                {!v.isActive && <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Deactivated</span>}
                                            </p>
                                            {v.description && <p className="text-[11px] text-slate-500 line-clamp-2">{v.description}</p>}
                                        </div>
                                        <RowActions v={v} canManage={canManage} hasDetail={Boolean(totals)} busy={busyId === v.id} onEdit={() => setEditing(v)} onToggle={() => toggleActive(v)} />
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
                                        {v.email && <span className="flex items-center gap-1.5 break-all"><Mail size={11} className="text-slate-300 shrink-0" />{v.email}</span>}
                                        {v.phone && <span className="flex items-center gap-1.5"><Phone size={11} className="text-slate-300" />{v.phone}</span>}
                                        {canManage && v.accountNumber && <span className="flex items-center gap-1.5"><Landmark size={11} className="text-slate-300" />{v.bankName} · {v.accountNumber}</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
                                        <span className="text-slate-500">{v.memoCount} memo(s)</span>
                                        {t && <>
                                            <span className="text-slate-700">Invoice {formatNGN(t.expected)}</span>
                                            <span className="text-emerald-700">Paid {formatNGN(t.paid)}</span>
                                            <span className={t.outstanding > 0 ? 'text-violet-700' : 'text-slate-400'}>Owed {formatNGN(t.outstanding)}</span>
                                        </>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {(creating || editing) && (
                <VendorFormModal
                    vendor={editing}
                    showBankFields={canManage}
                    onClose={() => { setCreating(false); setEditing(null); }}
                    onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
                />
            )}
        </div>
    );
}

function RowActions({ v, canManage, hasDetail, busy, onEdit, onToggle }: {
    v: VendorRecord; canManage: boolean; hasDetail: boolean; busy: boolean; onEdit: () => void; onToggle: () => void;
}) {
    const btn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:text-[#0b2a5b] hover:border-slate-300';
    return (
        <div className="flex items-center justify-end gap-1.5 shrink-0">
            {hasDetail && (
                <Link href={`/dashboard/vendors/${v.id}`} className={btn} title="View payments" aria-label={`View payments for ${v.name}`}>
                    <ArrowUpRight size={14} />
                </Link>
            )}
            {canManage && (
                <>
                    <button type="button" onClick={onEdit} className={btn} title="Edit vendor" aria-label={`Edit ${v.name}`}>
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        disabled={busy}
                        className={cn(btn, v.isActive ? 'hover:text-rose-600' : 'hover:text-emerald-600')}
                        title={v.isActive ? 'Deactivate' : 'Reactivate'}
                        aria-label={`${v.isActive ? 'Deactivate' : 'Reactivate'} ${v.name}`}
                    >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                    </button>
                </>
            )}
        </div>
    );
}
