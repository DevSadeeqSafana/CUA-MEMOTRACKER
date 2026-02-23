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
    Users
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import ApprovalButtons from '@/components/memos/ApprovalButtons';
import AcknowledgeButton from '@/components/memos/AcknowledgeButton';
import MarkAsRead from '@/components/memos/MarkAsRead';
import MemoHistory from '@/components/memos/MemoHistory';
import ReviewerDecisionPanel from '@/components/memos/ReviewerDecisionPanel';
import MemoRoutingTracker from '@/components/memos/MemoRoutingTracker';

export default async function MemoDetailsPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid: memoUuid } = await params;
    const session = await auth();
    if (!session?.user?.id) return null;
    const currentUserId = parseInt(session.user.id);

    // Fetch memo with creator details by UUID
    const memos = await query(
        `SELECT m.*, u.username as creator_name, u.email as creator_email 
      FROM memos m 
      JOIN memo_system_users u ON m.created_by = u.id 
      WHERE m.uuid = ?`,
        [memoUuid]
    ) as any[];

    if (memos.length === 0) {
        notFound();
    }

    const memo = memos[0];
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
        `SELECT mr.*, u.username as recipient_name 
         FROM memo_recipients mr 
         JOIN memo_system_users u ON mr.recipient_id = u.id 
         WHERE mr.memo_id = ?`,
        [memo.id]
    ) as any[];

    // Role resolution
    const isCreator = memo.created_by === currentUserId;
    const currentApproval = approvals.find(a => a.status === 'Pending');
    const isPendingApprover = !isCreator && !!(currentApproval && currentApproval.approver_id === currentUserId);
    const isReviewer = !isCreator && (session.user as any).role?.includes('Reviewer');
    const recipientRecord = allRecipients.find(r => r.recipient_id === currentUserId);
    const isRecipient = !isCreator && !!recipientRecord;

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-in fade-in duration-700 font-sans">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#1a365d] transition-all group px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Cockpit
                </Link>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Index Reference</p>
                        <p className="text-sm font-black text-[#1a365d] font-mono tracking-tighter">REF/{memo.reference_number}</p>
                    </div>
                </div>
            </div>

            {/* Premium Header Card */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 flex flex-col items-end gap-3 z-10">
                    <div className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border-2 shadow-sm",
                        memo.status === 'Draft' && "bg-slate-50 border-slate-200 text-slate-400",
                        memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                        memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                        memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}>
                        Workflow: {memo.status}
                    </div>
                </div>

                <div className="space-y-6 max-w-4xl relative z-10">
                    <div className="flex items-center gap-4">
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
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black leading-tight text-[#1a365d] font-outfit uppercase tracking-tight">{memo.title}</h1>

                    <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#1a365d] flex items-center justify-center text-white text-base font-black shadow-xl shadow-blue-900/40">
                                {creatorInitial}
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Originator</p>
                                <p className="text-base font-black text-slate-900 leading-none">{memo.creator_name}</p>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-slate-100 hidden md:block"></div>

                        <div className="space-y-1">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Institutional Dept</p>
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
                </div>
            </div>

            {/* ─── CREATOR VIEW: Live Routing Tracker ─── */}
            {isCreator && (
                <MemoRoutingTracker
                    memo={memo}
                    approvals={approvals}
                    recipients={allRecipients}
                />
            )}

            {/* ─── LINE MANAGER / REVIEWER VIEW: Approval actions ─── */}
            {isPendingApprover && (
                isReviewer ? (
                    <ReviewerDecisionPanel
                        memoId={memo.id}
                        approvalId={currentApproval.id}
                        memoTitle={memo.title}
                    />
                ) : (
                    <div className="bg-[#1a365d] border border-blue-900 rounded-[2.5rem] p-12 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                        <div className="flex items-center gap-8 text-white relative z-10">
                            <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10">
                                <ShieldCheck size={40} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black font-outfit uppercase">Administrative Review</h3>
                                <p className="text-blue-100/70 font-medium text-lg">Verification required for internal routing.</p>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <ApprovalButtons memoId={memo.id} approvalId={currentApproval.id} />
                        </div>
                    </div>
                )
            )}

            {/* ─── RECIPIENT VIEW: Acknowledge banner ─── */}
            {isRecipient && memo.status === 'Distributed' && (
                <div className="bg-emerald-600 border border-emerald-700 rounded-[2.5rem] p-12 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden group">
                    <MarkAsRead memoId={memo.id} />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="flex items-center gap-8 text-white relative z-10">
                        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/10">
                            <CheckCircle2 size={40} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black font-outfit uppercase">Institutional Broadcast</h3>
                            <p className="text-emerald-50/70 font-medium text-lg">Formal acknowledgment of this communication is mandatory.</p>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <AcknowledgeButton
                            memoId={memo.id}
                            isAcknowledged={!!recipientRecord.acknowledged_at}
                        />
                    </div>
                </div>
            )}

            {/* Main Content & Shared Components */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-12">
                    {/* Content Body */}
                    <div className="bg-white border border-slate-200 rounded-[3rem] p-12 shadow-sm font-serif">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 border-b border-slate-100 pb-10 mb-12 flex items-center gap-3">
                            <FileText size={18} className="opacity-30" />
                            Official Statement Body
                        </h2>
                        <div
                            className="prose prose-slate prose-xl max-w-none text-slate-800 leading-relaxed font-sans"
                            dangerouslySetInnerHTML={{ __html: memo.content }}
                        />
                    </div>

                    {/* Full Dedicated History Timeline */}
                    <MemoHistory memo={memo} approvals={approvals} recipients={allRecipients} />
                </div>

                {/* Sidebar Context */}
                <div className="lg:col-span-4 space-y-10">
                    {/* Security Info Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 shadow-2xl space-y-10 text-white">
                        <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] border-b border-white/5 pb-6">Encryption & Standards</h3>

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
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-8">
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
