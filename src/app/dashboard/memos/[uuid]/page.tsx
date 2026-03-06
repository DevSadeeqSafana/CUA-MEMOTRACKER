import { auth } from '@/auth';
import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import {
    Calendar,
    Building,
    FileText,
    Clock,
    CheckCircle2,
    ArrowLeft,
    Paperclip,
    ShieldCheck,
    Tag,
    History,
    Users,
    Wallet,
    Target
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import ApprovalButtons from '@/components/memos/ApprovalButtons';
import AcknowledgeButton from '@/components/memos/AcknowledgeButton';
import MarkAsRead from '@/components/memos/MarkAsRead';
import MemoHistory from '@/components/memos/MemoHistory';
import ReviewerDecisionPanel from '@/components/memos/ReviewerDecisionPanel';
import MemoRoutingTracker from '@/components/memos/MemoRoutingTracker';
import LineManagerRoutingAdjustment from '@/components/memos/LineManagerRoutingAdjustment';
import ConsultationThread from '@/components/memos/ConsultationThread';
import { getRecipients, getManagers, getConsultations } from '@/lib/actions';

export default async function MemoDetailsPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid: memoUuid } = await params;
    const session = await auth();
    if (!session?.user?.id) return null;
    const currentUserId = parseInt(session.user.id);

    // Fetch memo with creator details and potential budget info
    const memos = await query(
        `SELECT m.*, u.username as creator_name, u.email as creator_email, u.line_manager_id as creator_line_manager_id,
                bi.year_id, bi.budget_category, bi.other_category
         FROM memos m 
         JOIN memo_system_users u ON m.created_by = u.id 
         LEFT JOIN memo_budget_info bi ON m.id = bi.memo_id
         WHERE m.uuid = ?`,
        [memoUuid]
    ) as any[];

    if (memos.length === 0) {
        notFound();
    }

    const memo = memos[0];

    // Fetch budget items if it's a budget memo
    const budgetItems = await query(
        `SELECT * FROM memo_budget_items WHERE memo_id = ?`,
        [memo.id]
    ) as any[];

    const budgetGrandTotal = budgetItems.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
    const creatorInitial = (memo.creator_name && memo.creator_name.length > 0) ? memo.creator_name[0].toUpperCase() : 'U';

    // Fetch approvals
    const approvals = await query(
        `SELECT a.*, u.username as approver_name 
      FROM memo_approvals a 
      JOIN memo_system_users u ON a.approver_id = u.id 
      WHERE a.memo_id = ? 
      ORDER BY a.step_order ASC`,
        [memo.id]
    ) as any[];

    // Fetch all recipients for the history timeline
    const allRecipients = await query(
        `SELECT mr.*, u.username as recipient_name, u.department
         FROM memo_recipients mr 
         JOIN memo_system_users u ON mr.recipient_id = u.id 
         WHERE mr.memo_id = ?`,
        [memo.id]
    ) as any[];

    // Fetch routing adjustment logs — CAST new_value as CHAR to ensure MySQL2 delivers it as a parseable string
    const routingLogs = await query(
        `SELECT al.id, al.user_id, al.action, al.timestamp,
                CAST(al.new_value AS CHAR) as new_value,
                u.username as action_by_name
         FROM audit_logs al
         JOIN memo_system_users u ON al.user_id = u.id
         WHERE al.table_name = 'memos' AND al.record_id = ? AND al.action = 'ADJUST_ROUTING'
         ORDER BY al.timestamp DESC`,
        [memo.id]
    ) as any[];

    // Role resolution
    const isCreator = memo.created_by === currentUserId;
    const currentApproval = approvals.find(a => a.status === 'Pending');
    const isPendingApprover = !isCreator && !!(currentApproval && currentApproval.approver_id === currentUserId);
    const isReviewer = !isCreator && (session.user as any).role?.includes('Reviewer');
    const recipientRecord = allRecipients.find(r => r.recipient_id === currentUserId);
    const isRecipient = !isCreator && !!recipientRecord;
    const isApprover = approvals.some(a => a.approver_id === currentUserId);
    const isCreatorsLineManager = memo.creator_line_manager_id === currentUserId;

    // Role-specific power: allow ANY pending approver to adjust routing (added approvers, line managers, etc)
    const canAdjustRouting = isPendingApprover;

    // Fetch data for routing adjustment if authorized
    const availableUsers = canAdjustRouting ? await getRecipients() : [];
    const availableManagers = canAdjustRouting ? await getManagers() : [];

    // Fetch consultation threads
    const consultations = await getConsultations(memo.id);

    // canForward: any pending approver OR anyone who has received a forward OR final recipients
    const isForwardRecipient = consultations.some((c: any) => c.to_user_id === currentUserId);
    const canForward = isPendingApprover || isForwardRecipient || isRecipient;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700 font-sans">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#1a365d] transition-all group px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back
                    <span className="hidden sm:inline">to Cockpit</span>
                </Link>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Index Reference</p>
                        <p className="text-sm font-black text-[#1a365d] font-mono tracking-tighter">REF/{memo.reference_number}</p>
                    </div>
                </div>
            </div>

            {/* Premium Header Card */}
            <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm relative overflow-hidden">
                {/* Status Badge — inline on mobile, absolute on desktop */}
                <div className="flex justify-end mb-4 md:mb-0 md:absolute md:top-0 md:right-0 md:p-6 md:flex md:flex-col md:items-end md:gap-3 z-10">
                    <div className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-3 md:px-4 py-1.5 md:py-2 rounded-xl border-2 shadow-sm",
                        memo.status === 'Draft' && "bg-slate-50 border-slate-200 text-slate-400",
                        memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                        memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                        memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}>
                        <span className="hidden sm:inline">Workflow: </span>{memo.status}
                    </div>
                </div>

                <div className="space-y-4 md:space-y-6 max-w-4xl relative z-10">
                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                        <div className={cn(
                            "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-2",
                            memo.priority === 'High' ? "bg-red-50 border-red-200 text-red-600" :
                                memo.priority === 'Medium' ? "bg-amber-50 border-amber-200 text-amber-600" :
                                    "bg-blue-50 border-blue-200 text-blue-600"
                        )}>
                            <Clock size={10} />
                            {memo.priority} Priority
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <Tag size={10} />
                            {memo.memo_type} Content
                        </div>
                        {budgetItems.length > 0 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-emerald-50 border-2 border-emerald-200 text-emerald-600 shadow-sm animate-pulse-subtle">
                                    <Wallet size={10} />
                                    Budget Requisition
                                </div>
                            </>
                        )}
                    </div>

                    <h1 className="text-lg md:text-xl lg:text-2xl font-black leading-tight text-[#1a365d] font-outfit uppercase tracking-tight">{memo.title}</h1>

                    <div className="flex flex-wrap items-center gap-4 md:gap-8 pt-4 md:pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#1a365d] flex items-center justify-center text-white text-base font-black shadow-xl shadow-blue-900/40">
                                {creatorInitial}
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Originator</p>
                                <p className="text-sm font-black text-slate-900 leading-none">{memo.creator_name}</p>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-slate-100 hidden md:block"></div>

                        <div className="space-y-1">
                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none">Institutional Dept</p>
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <Building size={14} className="text-blue-500" />
                                {memo.department}
                            </p>
                        </div>

                        <div className="h-6 w-px bg-slate-100 hidden md:block"></div>

                        <div className="space-y-1">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Authorized At</p>
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <Calendar size={14} className="text-blue-500" />
                                {formatDate(memo.created_at)}
                            </p>
                        </div>
                    </div>

                    {/* Budget Indicator Section */}
                    {budgetItems.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10">
                                        <Calendar size={16} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Fiscal Year</p>
                                        <p className="text-xs font-black text-slate-900 uppercase truncate">{memo.year_id}</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10">
                                        <Tag size={16} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Category</p>
                                        <p className="text-xs font-black text-slate-900 uppercase truncate">
                                            {memo.budget_category === 'Others' ? memo.other_category : memo.budget_category}
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-[#1a365d] border border-blue-900 rounded-xl p-3 flex items-center gap-3 shadow-xl shadow-blue-900/10">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                                        <span className="text-[10px] font-black">₦</span>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Total Commitments</p>
                                        <p className="text-xs font-black text-white truncate">₦{budgetGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Financial Breakdown</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="pb-4 text-[9px] font-black text-[#1a365d] uppercase tracking-widest">Line Item</th>
                                                <th className="pb-4 text-[9px] font-black text-[#1a365d] uppercase tracking-widest text-center">Qty</th>
                                                <th className="pb-4 text-[9px] font-black text-[#1a365d] uppercase tracking-widest text-right">Unit (₦)</th>
                                                <th className="pb-4 text-[9px] font-black text-[#1a365d] uppercase tracking-widest text-right">Subtotal (₦)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {budgetItems.map((item, idx) => (
                                                <tr key={idx} className="group">
                                                    <td className="py-4 pr-4">
                                                        <p className="text-xs font-black text-slate-900 uppercase">{item.name}</p>
                                                        {item.description && <p className="text-[9px] text-slate-400 font-bold mt-1 max-w-sm">{item.description}</p>}
                                                    </td>
                                                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{item.quantity}</td>
                                                    <td className="py-4 text-xs font-bold text-slate-600 text-right">₦{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="py-4 text-xs font-black text-[#1a365d] text-right">₦{parseFloat(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-slate-100 bg-slate-50/50">
                                                <td colSpan={3} className="py-4 pl-4 text-[10px] font-black text-[#1a365d] uppercase tracking-widest text-right">Aggregate Total</td>
                                                <td className="py-4 pr-4 text-sm font-black text-emerald-600 text-right">₦{budgetGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Routing Adjustment Notifications — compact inline style */}
            {routingLogs.length > 0 && isCreator && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <Users size={13} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Routing Update(s)</span>
                    </div>
                    {routingLogs.slice(0, 3).map((log: any) => {
                        let d: Record<string, any> = {};
                        try {
                            const raw = log.new_value;
                            if (raw !== null && raw !== undefined) {
                                d = typeof raw === 'string' ? JSON.parse(raw) : raw;
                            }
                        } catch (e) { d = {}; }

                        const actor = log.action_by_name || 'Your line manager';
                        const oldR = (d.oldRecipients || '').trim();
                        const newR = (d.newRecipients || '').trim();
                        const approver = (d.addedApprovers || '').trim();

                        let sentence = `${actor} adjusted this memo's routing.`;
                        if (oldR && newR && oldR !== newR) sentence = `${actor} changed recipient from "${oldR}" → "${newR}".`;
                        else if ((d.addedRecipients || '').trim()) sentence = `${actor} added "${(d.addedRecipients || '').trim()}" as recipient.`;
                        else if ((d.removedRecipients || '').trim()) sentence = `${actor} removed "${(d.removedRecipients || '').trim()}" from distribution.`;
                        if (approver) sentence += ` Added "${approver}" as approver.`;

                        return (
                            <div key={log.id} className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                <p className="text-[11px] font-medium text-amber-900 leading-snug">{sentence}</p>
                            </div>
                        );
                    })}
                    {routingLogs.length > 3 && (
                        <p className="text-[9px] font-black text-amber-500 uppercase">+{routingLogs.length - 3} more in audit trail</p>
                    )}
                </div>
            )}

            {/* ─── Shared: Live Routing Tracker (Visible to all authorized parties) ─── */}
            {(isCreator || isApprover || isRecipient || isCreatorsLineManager) && (
                <MemoRoutingTracker
                    memo={memo}
                    approvals={approvals}
                    recipients={allRecipients}
                    currentUserId={currentUserId}
                />
            )}

            {/* ─── LINE MANAGER / REVIEWER VIEW: Approval actions ─── */}
            {isPendingApprover && (
                isReviewer ? (
                    <ReviewerDecisionPanel
                        memoId={memo.id}
                        approvalId={currentApproval.id}
                        memoTitle={memo.title}
                        memoUuid={memo.uuid}
                        currentUserId={currentUserId}
                        currentUserName={(session.user as any).name || ''}
                        consultations={consultations}
                        canForward={canForward}
                        canAdjustRouting={canAdjustRouting}
                        initialRecipients={allRecipients.map(r => ({ id: r.recipient_id, username: r.recipient_name, department: r.department }))}
                        initialApprovers={approvals.map(a => ({ id: a.approver_id, username: a.approver_name, department: a.department }))}
                        availableUsers={availableUsers}
                        availableManagers={availableManagers}
                    />
                ) : (
                    <div className="bg-[#1a365d] border border-blue-900 rounded-2xl p-5 md:p-6 flex flex-col items-start gap-5 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10 w-full">
                            <div className="flex items-center gap-4 text-white">
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10 shrink-0">
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-base md:text-lg font-black font-outfit uppercase tracking-tight">Administrative Review</h3>
                                    <p className="text-blue-100/70 font-medium text-[11px]">Verification required for internal routing.</p>
                                </div>
                            </div>

                            {/* Forward for Input — right next to title */}
                            {canForward && (
                                <ConsultationThread
                                    memoId={memo.id}
                                    memoUuid={memo.uuid}
                                    currentUserId={currentUserId}
                                    currentUserName={(session.user as any).name || ''}
                                    consultations={consultations}
                                    canForward={canForward}
                                    buttonOnly
                                />
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 w-full">
                            {canAdjustRouting && (
                                <LineManagerRoutingAdjustment
                                    memoId={memo.id}
                                    initialRecipients={allRecipients.map(r => ({ id: r.recipient_id, username: r.recipient_name, department: r.department }))}
                                    initialApprovers={approvals.map(a => ({ id: a.approver_id, username: a.approver_name, department: a.department }))}
                                    availableUsers={availableUsers}
                                    availableManagers={availableManagers}
                                />
                            )}
                            <ApprovalButtons memoId={memo.id} approvalId={currentApproval.id} />
                        </div>
                    </div>
                )
            )}

            {/* ─── RECIPIENT VIEW: Acknowledge banner ─── */}
            {isRecipient && memo.status === 'Distributed' && (
                <div className="bg-emerald-600 border border-emerald-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5 shadow-xl relative overflow-hidden group">
                    <MarkAsRead memoId={memo.id} />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="flex items-center gap-4 md:gap-6 text-white relative z-10">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/10 shrink-0">
                            <CheckCircle2 size={24} className="md:hidden" /><CheckCircle2 size={32} className="hidden md:block" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base md:text-xl font-black font-outfit uppercase">Institutional Broadcast</h3>
                            <p className="text-emerald-50/70 font-medium text-xs md:text-sm">Formal acknowledgment of this communication is mandatory.</p>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {canForward && (
                            <ConsultationThread
                                memoId={memo.id}
                                memoUuid={memo.uuid}
                                currentUserId={currentUserId}
                                currentUserName={(session.user as any).name || ''}
                                consultations={consultations}
                                canForward={canForward}
                                buttonOnly
                            />
                        )}
                        <AcknowledgeButton
                            memoId={memo.id}
                            decision={recipientRecord.decision}
                        />
                    </div>
                </div>
            )}

            {/* Main Content & Shared Components */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-8">
                    {/* Content Body */}
                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-8 shadow-sm font-serif">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 border-b border-slate-100 pb-6 mb-8 flex items-center gap-3">
                            <FileText size={16} className="opacity-30" />
                            Official Statement Body
                        </h2>
                        <div
                            className="prose prose-slate prose-lg max-w-none text-slate-800 leading-relaxed font-sans"
                            dangerouslySetInnerHTML={{ __html: memo.content }}
                        />
                    </div>

                    {/* Full Dedicated History Timeline */}
                    <MemoHistory memo={memo} approvals={approvals} recipients={allRecipients} routingLogs={routingLogs} consultations={consultations} />

                    {/* Consultation Thread — read-only view below audit trail */}
                    {consultations.length > 0 && (
                        <ConsultationThread
                            memoId={memo.id}
                            memoUuid={memo.uuid}
                            currentUserId={currentUserId}
                            currentUserName={(session.user as any).name || ''}
                            consultations={consultations}
                            canForward={isForwardRecipient}
                            buttonOnly={false}
                        />
                    )}

                </div>

                {/* Sidebar Context */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Security Info Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-white">
                        <h3 className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] border-b border-white/5 pb-3">Encryption & Standards</h3>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <ShieldCheck size={14} className="text-blue-500" />
                                    Archive Link
                                </span>
                                <span className="text-xs font-bold font-mono text-blue-400">#CUA-{memo.id}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Clock size={14} className="text-blue-500" />
                                    Lifecycle
                                </span>
                                <span className="text-xs font-bold text-slate-300">{memo.expiry_date ? formatDate(memo.expiry_date) : 'IMMUTABLE'}</span>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-white/5 space-y-6">
                            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Institutional Verification</h4>
                            <p className="text-[11px] leading-relaxed text-slate-400 font-medium italic">
                                "This document is digitally registered under the Cosmopolitan University Abuja Audit Framework. All interactions are immutable and timestamped."
                            </p>
                        </div>
                    </div>

                    {/* Recipient Quick List */}
                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm space-y-6">
                        <h3 className="text-[10px] font-black text-[#1a365d] uppercase tracking-[0.2em] flex items-center gap-3">
                            <Users size={16} className="text-blue-500" />
                            Target Distribution
                        </h3>
                        <div className="space-y-3">
                            {allRecipients.map((rec) => (
                                <div key={rec.recipient_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                                            {rec.recipient_name[0]}
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 truncate">{rec.recipient_name}</span>
                                    </div>
                                    {rec.acknowledged_at ? (
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                    ) : (
                                        <Clock size={14} className="text-slate-200" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
