'use client';

import { useState, useMemo } from 'react';
import VendorPicker from '@/components/vendors/VendorPicker';
import type { VendorOption } from '@/lib/vendor-data';
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
import Pagination from '@/components/ui/Pagination';
import { updateFinanceMemoProcessingStatus } from '@/lib/actions';
import toast from 'react-hot-toast';


// Vendor attached to a finance queue row (Finance's choice, else the memo's vendor)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vendorFromRow(memo: any): VendorOption | null {
    if (!memo?.vendor_id) return null;
    return {
        id: Number(memo.vendor_id),
        name: memo.vendor_name || `Vendor #${memo.vendor_id}`,
        email: memo.vendor_email || null,
        phone: memo.vendor_phone || null,
        address: memo.vendor_address || null,
        bankName: memo.vendor_bank_name || null,
        accountName: memo.vendor_account_name || null,
        accountNumber: memo.vendor_account_number || null,
        isActive: memo.vendor_is_active === undefined ? true : Boolean(Number(memo.vendor_is_active)),
    };
}

const FINANCE_QUEUE_PAGE_SIZE = 10;

// ── Money helpers (amounts are NGN; compared in kobo to avoid rounding errors) ──
const naira = (value: number) => `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toKobo = (value: unknown) => Math.round((Number(String(value ?? '').replace(/,/g, '')) || 0) * 100);
const parseAmountInput = (value: string): number | null => {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
};

type FinancePayment = { id: number; amount: string | number; voucher_number: string; payment_note: string | null; paid_at: string };

// Total owed: the accountant's figure, otherwise the memo's budget items total
const memoTotal = (m: any) => Number(m.total_amount ?? 0) > 0 ? Number(m.total_amount) : (parseFloat(m.total_budget_amount) || 0);
const memoPaid = (m: any) => Number(m.paid_amount) || 0;
const memoPayments = (m: any): FinancePayment[] => {
    let list: any = m.payments_json;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());
};

// Suggestions for the bank name field (free text is still allowed).
const NIGERIAN_BANKS = [
    'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank', 'First Bank of Nigeria',
    'First City Monument Bank (FCMB)', 'Globus Bank', 'Guaranty Trust Bank (GTBank)', 'Jaiz Bank', 'Keystone Bank',
    'Kuda Microfinance Bank', 'Moniepoint Microfinance Bank', 'OPay', 'Optimus Bank', 'PalmPay', 'Parallex Bank',
    'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank', 'Sterling Bank', 'SunTrust Bank',
    'Taj Bank', 'Titan Trust Bank', 'Union Bank of Nigeria', 'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank',
    'Zenith Bank'
];

interface AccountantProcessingViewProps {
    initialMemos: any[];
}

export default function AccountantProcessingView({ initialMemos }: AccountantProcessingViewProps) {
    const router = useRouter();
    const [memos, setMemos] = useState<any[]>(initialMemos);
    const [selectedTab, setSelectedTab] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [activeModalMemo, setActiveModalMemo] = useState<any | null>(null);

    // Modal Form State
    const [processingStatus, setProcessingStatus] = useState<string>('Pending Processing');
    const [bankName, setBankName] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');
    const [accountNumber, setAccountNumber] = useState<string>('');
    const [processingNotes, setProcessingNotes] = useState<string>('');
    const [payeeName, setPayeeName] = useState<string>('');
    const [payeeAddress, setPayeeAddress] = useState<string>('');
    const [payeeVendor, setPayeeVendor] = useState<VendorOption | null>(null);
    // 'vendor': a registered vendor; 'other': payee entered by hand; null: not chosen yet
    const [payeeMode, setPayeeMode] = useState<'vendor' | 'other' | null>(null);
    const [totalAmount, setTotalAmount] = useState<string>('');
    const [payAmount, setPayAmount] = useState<string>('');
    const [paymentNote, setPaymentNote] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const total = initialMemos.length;
        const pending = initialMemos.filter(m => m.processing_status === 'Pending Processing').length;
        const inProgress = initialMemos.filter(m => m.processing_status === 'In Progress').length;
        const partiallyPaid = initialMemos.filter(m => m.processing_status === 'Partially Paid').length;
        const processed = initialMemos.filter(m => m.processing_status === 'Processed').length;
        const rejected = initialMemos.filter(m => m.processing_status === 'Rejected').length;
        const totalValue = initialMemos.reduce((sum, m) => sum + memoTotal(m), 0);

        return { total, pending, inProgress, partiallyPaid, processed, rejected, totalValue };
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
                const voucherMatch = memo.voucher_number?.toLowerCase().includes(q)
                    || memoPayments(memo).some(p => p.voucher_number?.toLowerCase().includes(q))
                    || memo.payee_name?.toLowerCase().includes(q)
                    || memo.vendor_name?.toLowerCase().includes(q);
                const catMatch = memo.category?.toLowerCase().includes(q);
                if (!titleMatch && !refMatch && !creatorMatch && !voucherMatch && !catMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [initialMemos, selectedTab, searchQuery]);

    // Pagination (client-side, over the filtered list)
    const totalPages = Math.max(1, Math.ceil(filteredMemos.length / FINANCE_QUEUE_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages); // stays valid when memos leave the list
    const pageStart = (currentPage - 1) * FINANCE_QUEUE_PAGE_SIZE;
    const pagedMemos = filteredMemos.slice(pageStart, pageStart + FINANCE_QUEUE_PAGE_SIZE);

    const openProcessingModal = (memo: any) => {
        setActiveModalMemo(memo);
        setProcessingStatus(memo.processing_status || 'Pending Processing');
        // Saved details win; otherwise pre-fill from the vendor (Finance's choice, else the memo's)
        const vendor = vendorFromRow(memo);
        setPayeeVendor(vendor);
        setBankName(memo.bank_name || vendor?.bankName || '');
        setAccountName(memo.account_name || vendor?.accountName || '');
        setAccountNumber(memo.account_number || vendor?.accountNumber || '');
        setProcessingNotes(memo.processing_notes || '');
        setPayeeName(memo.payee_name || vendor?.name || '');
        setPayeeAddress(memo.payee_address || vendor?.address || '');
        // A saved payee with no vendor link was entered by hand
        setPayeeMode(vendor ? 'vendor' : memo.payee_name ? 'other' : null);
        const total = memoTotal(memo);
        setTotalAmount(total > 0 ? String(total) : '');
        setPayAmount('');
        setPaymentNote('');
    };

    // ── Derived values for the open memo ──
    const modalPayments = activeModalMemo ? memoPayments(activeModalMemo) : [];
    const paidSoFarKobo = activeModalMemo ? toKobo(memoPaid(activeModalMemo)) : 0;
    const totalParsed = parseAmountInput(totalAmount);
    const payParsed = parseAmountInput(payAmount);
    const totalKobo = totalParsed !== null && !Number.isNaN(totalParsed) ? Math.round(totalParsed * 100) : 0;
    const payKobo = payParsed !== null && !Number.isNaN(payParsed) ? Math.round(payParsed * 100) : 0;
    const balanceBeforeKobo = Math.max(totalKobo - paidSoFarKobo, 0);
    const balanceAfterKobo = Math.max(balanceBeforeKobo - payKobo, 0);
    const hasPayments = paidSoFarKobo > 0;
    const paying = payKobo > 0;
    const fullyPaid = totalKobo > 0 && paidSoFarKobo >= totalKobo;

    const accountNumberValid = accountNumber === '' || /^\d{10}$/.test(accountNumber);
    const accountDetailsComplete = bankName.trim() !== '' && accountName.trim() !== '' && /^\d{10}$/.test(accountNumber);
    const payeeComplete = payeeName.trim() !== '' && payeeAddress.trim() !== '';
    const needsPaymentDetails = paying || processingStatus === 'Processed';

    // Status the record will end up with after saving (mirrors the server rules)
    const resultingStatus = (paidSoFarKobo + payKobo) > 0
        ? (totalKobo > 0 && paidSoFarKobo + payKobo >= totalKobo ? 'Processed' : 'Partially Paid')
        : processingStatus;

    const handleSaveProcessing = async () => {
        if (!activeModalMemo) return;
        if (totalParsed !== null && (Number.isNaN(totalParsed) || totalParsed < 0)) {
            toast.error('Enter the total amount as a number, e.g. 700000.');
            return;
        }
        if (payParsed !== null && (Number.isNaN(payParsed) || payParsed <= 0)) {
            toast.error('Enter the amount to pay as a number greater than zero, e.g. 400000.');
            return;
        }
        if (totalKobo > 0 && totalKobo < paidSoFarKobo) {
            toast.error(`The total amount cannot be less than what has already been paid (${naira(paidSoFarKobo / 100)}).`);
            return;
        }
        if (paying && payKobo > balanceBeforeKobo) {
            toast.error(`The amount to pay is more than the balance left (${naira(balanceBeforeKobo / 100)}).`);
            return;
        }
        if (!accountNumberValid) {
            toast.error('Account number must be exactly 10 digits.');
            return;
        }
        if (needsPaymentDetails && (!payeeComplete || !accountDetailsComplete || totalKobo <= 0)) {
            toast.error('Enter the payee name and address, the total amount and the bank details before recording a payment.');
            return;
        }
        if (processingStatus === 'Processed' && !paying && totalKobo > paidSoFarKobo) {
            toast.error(`There is still ${naira(balanceBeforeKobo / 100)} left to pay. Enter it under "Pay now" to complete this memo.`);
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await updateFinanceMemoProcessingStatus(activeModalMemo.processing_id, {
                status: processingStatus as any,
                notes: processingNotes,
                account: { bankName, accountName, accountNumber },
                payee: { name: payeeName, address: payeeAddress, vendorId: payeeVendor?.id ?? null },
                totalAmount: totalAmount === '' ? null : totalAmount,
                payment: paying ? { amount: payAmount, note: paymentNote } : null,
            });

            if (res.success) {
                if (res.voucherNumber) {
                    const balance = Number(res.balance) || 0;
                    toast.success(balance > 0
                        ? `Payment recorded with voucher ${res.voucherNumber}. ${naira(balance)} is left to be settled later.`
                        : `Payment recorded with voucher ${res.voucherNumber}. This memo is now fully paid.`);
                } else {
                    toast.success('Processing record saved.');
                }
                setActiveModalMemo(null);
                router.refresh();
            } else {
                toast.error(res.error || "We couldn't save the processing record. Please try again.");
            }
        } catch (error: any) {
            console.error('Processing update error:', error);
            toast.error("We couldn't save the processing record. Please try again.");
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
            case 'Partially Paid':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <CreditCard size={12} />
                        Partially Paid
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
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0b2a5b] via-[#1e293b] to-[#0f172a] rounded-2xl p-8 text-white shadow-xl border border-white/10">
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
                            Queue of approved memos sent for financial processing. Verify budget allocations, assign Payment Voucher (PV) numbers, and process disbursement requests.
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 shrink-0 flex items-center gap-3">
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
                        <p className="text-2xl font-black text-amber-600 mt-1">{stats.pending + stats.inProgress + stats.partiallyPaid}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-0.5">{stats.pending} Pending • {stats.inProgress} In Progress • {stats.partiallyPaid} Part-paid</p>
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
                        {['All', 'Pending Processing', 'In Progress', 'Partially Paid', 'Processed', 'Rejected'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => { setSelectedTab(tab); setPage(1); }}
                                className={cn(
                                    "px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap",
                                    selectedTab === tab
                                        ? "bg-[#0b2a5b] text-white shadow-sm"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                {tab}
                                {tab === 'All' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/20 text-white font-black">{stats.total}</span>}
                                {tab === 'Pending Processing' && stats.pending > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-black">{stats.pending}</span>}
                                {tab === 'In Progress' && stats.inProgress > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500 text-white font-black">{stats.inProgress}</span>}
                                {tab === 'Partially Paid' && stats.partiallyPaid > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-violet-500 text-white font-black">{stats.partiallyPaid}</span>}
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
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
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
                                    <th className="py-3.5 px-4">Amount (NGN)</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Voucher No.</th>
                                    <th className="py-3.5 px-4">Date Routed</th>
                                    <th className="py-3.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {pagedMemos.map(memo => {
                                    const amount = memoTotal(memo);
                                    const paid = memoPaid(memo);
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
                                                        {amount > 0 ? naira(amount) : <span className="text-slate-400 font-semibold text-xs italic">Not set</span>}
                                                    </span>
                                                    {paid > 0 && (
                                                        <span className="text-[10px] font-bold">
                                                            <span className="text-emerald-600">Paid {naira(paid)}</span>
                                                            {amount - paid > 0 && <span className="text-violet-600"> · Bal {naira(amount - paid)}</span>}
                                                        </span>
                                                    )}
                                                    {(memo.payee_name || memo.vendor_name) && (
                                                        <span className="text-[10px] text-slate-500 font-semibold line-clamp-1">To: {memo.payee_name || memo.vendor_name}</span>
                                                    )}
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
                                                    <>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 font-mono font-bold text-[11px] text-slate-800 rounded-md">
                                                        <Receipt size={12} className="text-blue-600" />
                                                        {memo.voucher_number}
                                                    </span>
                                                    {memoPayments(memo).length > 1 && (
                                                        <span className="block text-[10px] text-slate-400 font-bold mt-1">+{memoPayments(memo).length - 1} more</span>
                                                    )}
                                                    </>
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
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b2a5b] hover:bg-[#082352] text-white rounded-lg font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95"
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
                {filteredMemos.length > 0 && (
                    <>
                        <p className="px-4 sm:px-8 py-3 text-[11px] font-bold text-slate-400 border-t border-slate-100">
                            Showing {pageStart + 1}–{pageStart + pagedMemos.length} of {filteredMemos.length} memo{filteredMemos.length === 1 ? '' : 's'}
                        </p>
                        <Pagination totalPages={totalPages} currentPage={currentPage} onPageChange={setPage} />
                    </>
                )}
            </div>

            {/* Interactive Update Modal */}
            {activeModalMemo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#0b2a5b] to-[#0f172a] px-6 py-5 text-white flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-1.5 text-blue-300 font-bold text-[10px] uppercase tracking-wider">
                                    <Landmark size={12} />
                                    Accountant Financial Processing
                                </div>
                                <h3 className="text-base md:text-lg font-black text-white mt-0.5 break-words">
                                    {activeModalMemo.title}
                                </h3>
                                <p className="text-xs font-mono text-slate-300">
                                    Ref: {activeModalMemo.reference_number || 'N/A'} · Requested by {activeModalMemo.creator_name}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setActiveModalMemo(null)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 md:p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* ── Left: who is being paid ── */}
                                <div className="space-y-5">
                                    {/* Payee */}
                                    <div>
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Payee (Vendor / Company / Organisation)</label>
                                            <span className={cn('text-[10px] font-bold', needsPaymentDetails ? 'text-rose-500' : 'text-slate-400')}>
                                                {needsPaymentDetails ? 'Required to pay' : 'Required before payment'}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {payeeMode === 'other' ? (
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                                                    <span className="text-[11px] font-bold text-amber-700">Other payee: not a registered vendor</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setPayeeMode(null); setPayeeName(''); setPayeeAddress(''); }}
                                                        className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#1a5aa6] hover:underline"
                                                    >
                                                        Choose from vendor list
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Vendor</span>
                                                    <VendorPicker
                                                        value={payeeVendor}
                                                        compact
                                                        hideContact
                                                        placeholder="Search vendors by name…"
                                                        onOther={() => {
                                                            // Start the manual entry clean if a vendor had filled the form
                                                            if (payeeVendor) {
                                                                setPayeeName(''); setPayeeAddress('');
                                                                setBankName(''); setAccountName(''); setAccountNumber('');
                                                            }
                                                            setPayeeVendor(null);
                                                            setPayeeMode('other');
                                                        }}
                                                        onChange={v => {
                                                            setPayeeVendor(v);
                                                            if (!v) {
                                                                setPayeeMode(null);
                                                                setPayeeName(''); setPayeeAddress('');
                                                                return;
                                                            }
                                                            setPayeeMode('vendor');
                                                            setPayeeName(v.name);
                                                            setPayeeAddress(v.address || '');
                                                            if (v.bankName) setBankName(v.bankName);
                                                            if (v.accountName) setAccountName(v.accountName);
                                                            if (v.accountNumber) setAccountNumber(v.accountNumber);
                                                        }}
                                                    />
                                                    {activeModalMemo?.memo_vendor_id && payeeVendor && payeeVendor.id !== Number(activeModalMemo.memo_vendor_id) && (
                                                        <p className="mt-1 text-[10px] font-semibold text-amber-600">Different from the vendor named on the memo.</p>
                                                    )}
                                                    {!payeeMode && (
                                                        <p className={cn('mt-1 text-[10px] font-semibold', needsPaymentDetails ? 'text-rose-500' : 'text-slate-400')}>
                                                            Pick a registered vendor, or choose &ldquo;Other&rdquo; at the bottom of the list to enter the payee yourself.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Manual entry ("Other"): name and address */}
                                            {payeeMode === 'other' && (
                                                <div>
                                                    <label htmlFor="fp-payee-name" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payee name</label>
                                                    <input
                                                        id="fp-payee-name"
                                                        type="text"
                                                        autoFocus
                                                        value={payeeName}
                                                        onChange={e => setPayeeName(e.target.value)}
                                                        maxLength={200}
                                                        placeholder="e.g. Sahara Office Supplies Ltd"
                                                        className={cn(
                                                            'w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                            needsPaymentDetails && !payeeName.trim() ? 'border-rose-300' : 'border-slate-200'
                                                        )}
                                                    />
                                                </div>
                                            )}
                                            {/* Address: typed for "Other"; pre-filled (and editable) for a vendor */}
                                            {payeeMode && (
                                                <div>
                                                    <label htmlFor="fp-payee-address" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                                        {payeeMode === 'vendor' ? 'Vendor address' : 'Payee address'}
                                                    </label>
                                                    <textarea
                                                        id="fp-payee-address"
                                                        value={payeeAddress}
                                                        onChange={e => setPayeeAddress(e.target.value)}
                                                        maxLength={500}
                                                        rows={2}
                                                        placeholder="Street, city, state"
                                                        className={cn(
                                                            'w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 transition-all resize-none',
                                                            needsPaymentDetails && !payeeAddress.trim() ? 'border-rose-300' : 'border-slate-200'
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Beneficiary bank account */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payee Bank Account</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label htmlFor="fp-bank-name" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Bank Name</label>
                                                <input
                                                    id="fp-bank-name"
                                                    type="text"
                                                    list="fp-bank-options"
                                                    value={bankName}
                                                    onChange={e => setBankName(e.target.value)}
                                                    maxLength={120}
                                                    placeholder="e.g. Access Bank"
                                                    className={cn(
                                                        'w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                        needsPaymentDetails && !bankName.trim() ? 'border-rose-300' : 'border-slate-200'
                                                    )}
                                                />
                                                <datalist id="fp-bank-options">
                                                    {NIGERIAN_BANKS.map(bank => <option key={bank} value={bank} />)}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label htmlFor="fp-account-number" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Account Number</label>
                                                <input
                                                    id="fp-account-number"
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="off"
                                                    value={accountNumber}
                                                    onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                    placeholder="10-digit NUBAN"
                                                    className={cn(
                                                        'w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-mono font-bold tracking-wider text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                        !accountNumberValid || (needsPaymentDetails && !accountNumber) ? 'border-rose-300' : 'border-slate-200'
                                                    )}
                                                />
                                                {!accountNumberValid && (
                                                    <p className="text-[10px] font-bold text-rose-500 mt-1">{accountNumber.length}/10 digits</p>
                                                )}
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label htmlFor="fp-account-name" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Account Name</label>
                                                <input
                                                    id="fp-account-name"
                                                    type="text"
                                                    value={accountName}
                                                    onChange={e => setAccountName(e.target.value)}
                                                    maxLength={150}
                                                    placeholder="Name on the bank account"
                                                    className={cn(
                                                        'w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                        needsPaymentDetails && !accountName.trim() ? 'border-rose-300' : 'border-slate-200'
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Right: how much, and payments ── */}
                                <div className="space-y-5">
                                    {/* Amount summary */}
                                    <div>
                                        <label htmlFor="fp-total" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Total Amount Owed (NGN)</label>
                                        <input
                                            id="fp-total"
                                            type="text"
                                            inputMode="decimal"
                                            value={totalAmount}
                                            onChange={e => setTotalAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                                            placeholder="e.g. 700000"
                                            className={cn(
                                                'w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                (totalParsed !== null && Number.isNaN(totalParsed)) || (needsPaymentDetails && totalKobo <= 0) ? 'border-rose-300' : 'border-slate-200'
                                            )}
                                        />
                                        {Number(activeModalMemo.total_budget_amount) > 0 && (
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                                Budget items on the memo total {naira(Number(activeModalMemo.total_budget_amount))}.
                                            </p>
                                        )}
                                        <div className="grid grid-cols-3 gap-2 mt-3">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total</p>
                                                <p className="text-xs sm:text-sm font-black text-slate-800 break-all">{naira(totalKobo / 100)}</p>
                                            </div>
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Paid so far</p>
                                                <p className="text-xs sm:text-sm font-black text-emerald-700 break-all">{naira(paidSoFarKobo / 100)}</p>
                                            </div>
                                            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-violet-600">Balance</p>
                                                <p className="text-xs sm:text-sm font-black text-violet-700 break-all">{naira(balanceBeforeKobo / 100)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment history */}
                                    {modalPayments.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payments Made</p>
                                            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                                                {modalPayments.map(p => (
                                                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-slate-800">{naira(Number(p.amount))}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">
                                                                {formatDate(p.paid_at)}{p.payment_note ? ` · ${p.payment_note}` : ''}
                                                            </p>
                                                        </div>
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 font-mono font-bold text-[10px] text-slate-700 rounded-md">
                                                            <Receipt size={11} className="text-blue-600" />
                                                            {p.voucher_number}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pay now */}
                                    {fullyPaid ? (
                                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                                            <p className="text-xs font-bold text-emerald-800">This memo has been paid in full.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 space-y-3">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                <label htmlFor="fp-pay-now" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pay Now (NGN)</label>
                                                <span className="text-[10px] font-bold text-slate-400">Optional · can be part of the balance</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <input
                                                    id="fp-pay-now"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={payAmount}
                                                    onChange={e => setPayAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                                                    placeholder="e.g. 400000"
                                                    className={cn(
                                                        'flex-1 min-w-[10rem] px-3 py-2.5 bg-white border rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-blue-600 transition-all',
                                                        (payParsed !== null && Number.isNaN(payParsed)) || payKobo > balanceBeforeKobo ? 'border-rose-300' : 'border-slate-200'
                                                    )}
                                                />
                                                {balanceBeforeKobo > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayAmount(String(balanceBeforeKobo / 100))}
                                                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-wider text-[#0b2a5b] hover:bg-slate-100 transition-colors"
                                                    >
                                                        Pay full balance
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={paymentNote}
                                                onChange={e => setPaymentNote(e.target.value)}
                                                maxLength={500}
                                                placeholder="Payment note (optional), e.g. First instalment, transfer ref…"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 transition-all"
                                            />
                                            {paying && payKobo <= balanceBeforeKobo && (
                                                <p className="text-[11px] font-bold text-slate-600">
                                                    {balanceAfterKobo > 0
                                                        ? <>After this payment, <span className="text-violet-700">{naira(balanceAfterKobo / 100)}</span> will be left to settle later.</>
                                                        : <>This payment settles the full balance.</>}
                                                    {' '}A Payment Voucher number will be generated for it.
                                                </p>
                                            )}
                                            {payKobo > balanceBeforeKobo && (
                                                <p className="text-[11px] font-bold text-rose-500">This is more than the balance of {naira(balanceBeforeKobo / 100)}.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Full width: status and notes ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Processing Status</label>
                                    {hasPayments || paying ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-[11px] font-medium text-slate-500">Set automatically from the payments.</p>
                                            {getStatusBadge(resultingStatus)}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                                            {[
                                                { id: 'Pending Processing', label: 'Pending', color: 'amber' },
                                                { id: 'In Progress', label: 'In Progress', color: 'blue' },
                                                { id: 'Processed', label: 'Processed', color: 'emerald' },
                                                { id: 'Rejected', label: 'Rejected', color: 'rose' }
                                            ].map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setProcessingStatus(item.id)}
                                                    className={cn(
                                                        "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between gap-2",
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
                                                    {processingStatus === item.id && <CheckCircle2 size={14} className="shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        A part payment marks the memo <span className="font-bold text-violet-600">Partially Paid</span>; it becomes <span className="font-bold text-emerald-600">Processed</span> once the balance reaches zero.
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="fp-notes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        Accountant Notes & Disbursement Remarks
                                    </label>
                                    <textarea
                                        id="fp-notes"
                                        value={processingNotes}
                                        onChange={e => setProcessingNotes(e.target.value)}
                                        rows={4}
                                        placeholder="Processing remarks, payment schedule for the balance, or rejection reason..."
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 px-5 md:px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <Link
                                href={`/dashboard/memos/${activeModalMemo.uuid}`}
                                target="_blank"
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                Open Full Memo
                                <ArrowUpRight size={13} />
                            </Link>
                            <div className="flex flex-wrap items-center gap-2">
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
                                    className="px-5 py-2 bg-[#0b2a5b] hover:bg-[#082352] text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? 'Saving...' : paying ? 'Record Payment & Save' : 'Save Processing Record'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
