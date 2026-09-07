'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Landmark,
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    FileText,
    Search,
    Filter,
    ArrowUpRight,
    DollarSign,
    CreditCard,
    Edit3,
    Receipt,
    User,
    Calendar,
    ChevronRight,
    Tag,
    X
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { updateFinanceMemoProcessingStatus } from '@/lib/actions';
import toast from 'react-hot-toast';

interface AccountantProcessingViewProps {
    initialMemos: any[];
}

export default function AccountantProcessingView({ initialMemos }: AccountantProcessingViewProps) {
    const router = useRouter();
    const [memos, setMemos] = useState<any[]>(initialMemos);
    const [selectedTab, setSelectedTab] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeModalMemo, setActiveModalMemo] = useState<any | null>(null);

    // Modal Form State
    const [processingStatus, setProcessingStatus] = useState<string>('Pending Processing');
    const [voucherNumber, setVoucherNumber] = useState<string>('');
    const [processingNotes, setProcessingNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const total = initialMemos.length;
        const pending = initialMemos.filter(m => m.processing_status === 'Pending Processing').length;
        const inProgress = initialMemos.filter(m => m.processing_status === 'In Progress').length;
        const processed = initialMemos.filter(m => m.processing_status === 'Processed').length;
        const rejected = initialMemos.filter(m => m.processing_status === 'Rejected').length;
        const totalValue = initialMemos.reduce((sum, m) => sum + (parseFloat(m.total_budget_amount) || 0), 0);

        return { total, pending, inProgress, processed, rejected, totalValue };
    }, [initialMemos]);

    // Filter Memos
    const filteredMemos = useMemo(() => {
        return initialMemos.filter(memo => {
            // Tab filter
            if (selectedTab !== 'All' && memo.processing_status !== selectedTab) {
                return false;
            }
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = memo.title?.toLowerCase().includes(q);
                const refMatch = memo.reference_number?.toLowerCase().includes(q);
                const creatorMatch = memo.creator_name?.toLowerCase().includes(q);
                const voucherMatch = memo.voucher_number?.toLowerCase().includes(q);
                const catMatch = memo.category?.toLowerCase().includes(q);
                if (!titleMatch && !refMatch && !creatorMatch && !voucherMatch && !catMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [initialMemos, selectedTab, searchQuery]);

    const openProcessingModal = (memo: any) => {
        setActiveModalMemo(memo);
        setProcessingStatus(memo.processing_status || 'Pending Processing');
        setVoucherNumber(memo.voucher_number || '');
        setProcessingNotes(memo.processing_notes || '');
    };

    const handleSaveProcessing = async () => {
        if (!activeModalMemo) return;
        setIsSubmitting(true);
        try {
            const res = await updateFinanceMemoProcessingStatus(
                activeModalMemo.processing_id,
                processingStatus as any,
                processingNotes,
                voucherNumber
            );

            if (res.success) {
                toast.success('Financial processing record updated successfully!');
                setActiveModalMemo(null);
                router.refresh();
            } else {
                toast.error(res.error || 'Failed to update record');
            }
        } catch (error: any) {
            console.error('Processing update error:', error);
            toast.error('An error occurred while saving.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Processed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 size={12} />
                        Processed
                    </span>
                );
            case 'In Progress':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <Clock size={12} />
                        In Progress
                    </span>
                );
            case 'Rejected':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <XCircle size={12} />
                        Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <AlertCircle size={12} />
                        Pending Processing
                    </span>
                );
        }
    };

    return (
        <div className="space-y-8">
            {/* Header Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1a365d] via-[#1e293b] to-[#0f172a] rounded-2xl p-8 text-white shadow-xl border border-white/10">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-widest mb-3">
                            <Landmark size={14} />
                            Bursary & Financial Controller Office
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            University Accountant Finance Queue
                        </h1>
                        <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-xl font-medium">
                            Automated queue for fully approved financial budget memos. Verify budget allocations, assign Payment Voucher (PV) numbers, and process disbursement requests.
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 shrink-0 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-[#1a365d] font-black text-lg shadow-lg">
                            CTO
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Accountant In-Charge</p>
                            <p className="text-sm font-black text-white">Chidi Teddy Ojiako</p>
                            <p className="text-[10px] text-amber-300 font-semibold">University Accountant • E0152</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Financial Memos</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Approved & Routed</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <FileText size={22} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Value (NGN)</p>
                        <p className="text-xl font-black text-slate-800 mt-1">
                            ₦{stats.totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Budget Allocations Sum</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <CreditCard size={22} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Action</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{stats.pending + stats.inProgress}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-0.5">{stats.pending} Pending • {stats.inProgress} In Progress</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                        <Clock size={22} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vouched / Processed</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{stats.processed}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{stats.rejected} Rejected</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={22} />
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
                        {['All', 'Pending Processing', 'In Progress', 'Processed', 'Rejected'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={cn(
                                    "px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap",
                                    selectedTab === tab
                                        ? "bg-[#1a365d] text-white shadow-sm"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                {tab}
                                {tab === 'All' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/20 text-white font-black">{stats.total}</span>}
                                {tab === 'Pending Processing' && stats.pending > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-black">{stats.pending}</span>}
                                {tab === 'In Progress' && stats.inProgress > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500 text-white font-black">{stats.inProgress}</span>}
                                {tab === 'Processed' && stats.processed > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500 text-white font-black">{stats.processed}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search reference, title, PV..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Memos Table / List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredMemos.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <Receipt size={32} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">No Financial Memos Found</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            {selectedTab !== 'All' || searchQuery
                                ? 'No financial memos match the selected filter criteria.'
                                : 'When financial budget memos receive final approval, they will automatically appear in this queue.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Reference & Title</th>
                                    <th className="py-3.5 px-4">Creator / Department</th>
                                    <th className="py-3.5 px-4">Budget Total (NGN)</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Voucher No.</th>
                                    <th className="py-3.5 px-4">Date Routed</th>
                                    <th className="py-3.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredMemos.map(memo => {
                                    const amount = parseFloat(memo.total_budget_amount) || 0;
                                    return (
                                        <tr key={memo.processing_id} className="hover:bg-slate-50/80 transition-colors group">
                                            {/* Title & Ref */}
                                            <td className="py-4 px-4 max-w-xs">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-[10px] font-bold text-blue-600 tracking-wider">
                                                        {memo.reference_number || 'N/A'}
                                                    </span>
                                                    <Link
                                                        href={`/dashboard/memos/${memo.uuid}`}
                                                        className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1 mt-0.5 flex items-center gap-1"
                                                    >
                                                        {memo.title}
                                                        <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                    </Link>
                                                    {memo.category && (
                                                        <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                                            Category: {memo.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Creator */}
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{memo.creator_name}</span>
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        {memo.creator_designation || 'Staff'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-sm">
                                                        ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {memo.budget_items_count > 0 && (
                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                            {memo.budget_items_count} Item(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="py-4 px-4">
                                                {getStatusBadge(memo.processing_status)}
                                            </td>

                                            {/* Voucher Number */}
                                            <td className="py-4 px-4">
                                                {memo.voucher_number ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 font-mono font-bold text-[11px] text-slate-800 rounded-md">
                                                        <Receipt size={12} className="text-blue-600" />
                                                        {memo.voucher_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-medium italic text-[11px]">Unassigned</span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="py-4 px-4 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                                                {formatDate(memo.routed_at)}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-4 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => openProcessingModal(memo)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a365d] hover:bg-[#152a48] text-white rounded-lg font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95"
                                                >
                                                    <Edit3 size={13} />
                                                    Process Status
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Interactive Update Modal */}
            {activeModalMemo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#1a365d] to-[#0f172a] p-5 text-white flex items-center justify-between">
                            <div>
                                <div className="inline-flex items-center gap-1.5 text-blue-300 font-bold text-[10px] uppercase tracking-wider">
                                    <Landmark size={12} />
                                    Accountant Financial Processing
                                </div>
                                <h3 className="text-base font-black text-white mt-0.5 line-clamp-1">
                                    {activeModalMemo.title}
                                </h3>
                                <p className="text-xs font-mono text-slate-300">
                                    Ref: {activeModalMemo.reference_number || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveModalMemo(null)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Summary Card inside modal */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Requisition Creator</p>
                                    <p className="text-xs font-bold text-slate-800">{activeModalMemo.creator_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Total Amount</p>
                                    <p className="text-sm font-black text-emerald-700">
                                        ₦{(parseFloat(activeModalMemo.total_budget_amount) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* Processing Status Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Processing Status
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'Pending Processing', label: 'Pending', color: 'amber' },
                                        { id: 'In Progress', label: 'In Progress', color: 'blue' },
                                        { id: 'Processed', label: 'Processed / Vouchered', color: 'emerald' },
                                        { id: 'Rejected', label: 'Rejected', color: 'rose' }
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setProcessingStatus(item.id)}
                                            className={cn(
                                                "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between",
                                                processingStatus === item.id
                                                    ? item.color === 'emerald'
                                                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                                                        : item.color === 'blue'
                                                        ? "bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20"
                                                        : item.color === 'rose'
                                                        ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20"
                                                        : "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            <span>{item.label}</span>
                                            {processingStatus === item.id && (
                                                <CheckCircle2 size={14} className="shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Voucher Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Payment Voucher (PV) Number
                                </label>
                                <div className="relative">
                                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={voucherNumber}
                                        onChange={e => setVoucherNumber(e.target.value)}
                                        placeholder="e.g. PV/2026/0481"
                                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600 transition-all"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Enter Bursary payment voucher code for audit reference.</p>
                            </div>

                            {/* Processing Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Accountant Notes & Disbursement Remarks
                                </label>
                                <textarea
                                    value={processingNotes}
                                    onChange={e => setProcessingNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Add processing remarks, bank reference details, or rejection cause..."
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <Link
                                href={`/dashboard/memos/${activeModalMemo.uuid}`}
                                target="_blank"
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                Open Full Memo
                                <ArrowUpRight size={13} />
                            </Link>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveModalMemo(null)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveProcessing}
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-[#1a365d] hover:bg-[#142b4b] text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Processing Record'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
