export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
    CheckCircle2,
    Clock,
    FileText,
    AlertCircle,
    ChevronRight,
    Inbox,
    Bell,
    ShieldCheck,
    Wallet,
    History,
    Search,
    Forward
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';

export default async function TaskCenterPage() {
    const session = await auth();
    if (!session?.user) return null;
    const userId = session.user.id;

    // 1. Pending Approvals (For Line Managers / Reviewers)
    // Only shows if it's currently THEIR turn to approve
    const pendingApprovals = await query(
        `SELECT m.*, u.username as creator_name, a.id as approval_id, a.step_order,
                (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo 
     FROM memos m 
     JOIN memo_approvals a ON m.id = a.memo_id 
     JOIN memo_system_users u ON m.created_by = u.id 
     WHERE a.approver_id = ? 
     AND a.status = 'Pending' 
     AND NOT EXISTS (
         SELECT 1 FROM memo_approvals a2 
         WHERE a2.memo_id = m.id 
         AND a2.step_order < a.step_order 
         AND a2.status != 'Approved'
     )
     ORDER BY m.created_at DESC`,
        [userId]
    ) as any[];

    // 1.5 Pending Forwards (Consultations needing input)
    const consultationRequests = await query(
        `SELECT m.*, u.username as creator_name, c.created_at as forwarded_at, c.from_user_id, fu.username as forwarded_by, c.id as consultation_id,
                (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo
         FROM memos m
         JOIN memo_consultations c ON m.id = c.memo_id
         JOIN memo_system_users u ON m.created_by = u.id
         JOIN memo_system_users fu ON c.from_user_id = fu.id
         WHERE c.to_user_id = ? AND c.type = 'Forward'
         AND NOT EXISTS (
             SELECT 1 FROM memo_consultations r 
             WHERE r.parent_id = c.id AND r.from_user_id = ? AND r.type = 'Response'
         )
         ORDER BY c.created_at DESC`,
        [userId, userId]
    ) as any[];

    // Combine approvals and consultations for the Action Items column
    const pendingActions = [
        ...pendingApprovals.map(m => ({ ...m, action_type: 'Approval', sort_date: m.created_at })),
        ...consultationRequests.map((m: any) => ({ ...m, action_type: 'Consultation', sort_date: m.forwarded_at }))
    ].sort((a, b) => new Date(b.sort_date).getTime() - new Date(a.sort_date).getTime());

    // 2. Distributed Memos (For Recipients / Receivers)
    const distributedMemos = await query(
        `SELECT m.*, u.username as creator_name, mr.read_at, mr.acknowledged_at,
                (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo
     FROM memos m
     JOIN memo_recipients mr ON m.id = mr.memo_id
     JOIN memo_system_users u ON m.created_by = u.id
     WHERE mr.recipient_id = ? AND m.status = 'Distributed'
     ORDER BY m.created_at DESC`,
        [userId]
    ) as any[];

    // 3. Processed Approvals (For Managers to track progress)
    const processedApprovals = await query(
        `SELECT m.*, u.username as creator_name, a.status as my_decision, a.processed_at,
                (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo
     FROM memos m
     JOIN memo_approvals a ON m.id = a.memo_id
     JOIN memo_system_users u ON m.created_by = u.id
     WHERE a.approver_id = ? AND a.status IN ('Approved', 'Rejected')
     ORDER BY a.processed_at DESC
     LIMIT 10`,
        [userId]
    ) as any[];

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                            <Inbox size={18} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#1a365d] font-outfit">Task Center</h1>
                    </div>
                    <p className="text-xs text-slate-500 font-medium ml-[44px]">Aggregated institutional actions and received communications.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Critical Approvals Column */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-base font-black text-[#1a365d] flex items-center gap-3 font-outfit uppercase tracking-wider">
                            <ShieldCheck className="text-blue-500" size={20} />
                            Pending Decisions
                        </h2>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                            {pendingActions.length} Required
                        </span>
                    </div>

                    <div className="space-y-4">
                        {pendingActions.length === 0 ? (
                            <div className="bg-white border border-slate-200 border-dashed rounded-[2rem] p-16 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <Clock size={32} />
                                </div>
                                <p className="text-slate-400 font-bold text-sm">Your decision queue is currently empty.</p>
                            </div>
                        ) : (
                            pendingActions.map(memo => (
                                <Link
                                    key={memo.action_type === 'Approval' ? `app-${memo.approval_id}` : `cons-${memo.consultation_id}`}
                                    href={`/dashboard/memos/${memo.uuid}`}
                                    className="block bg-white border border-slate-200 rounded-3xl p-6 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/10 transition-all group"
                                >
                                    <div className="flex items-start gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1a365d] group-hover:bg-[#1a365d] group-hover:text-white transition-all shrink-0">
                                            {memo.action_type === 'Consultation' ? <Forward size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div className="flex-grow min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest shrink-0",
                                                    memo.action_type === 'Consultation' ? "text-purple-600 bg-purple-50 border-purple-100" : "text-blue-600 bg-blue-50 border-blue-100"
                                                )}>
                                                    {memo.action_type === 'Consultation' ? 'Input Requested' : `Step ${memo.step_order}`}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                                                    {memo.reference_number}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">{memo.title}</h4>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400">
                                                        {memo.creator_name[0]}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500">{memo.creator_name}</span>
                                                </div>
                                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                <span className="text-[10px] font-bold text-slate-400">{memo.department}</span>
                                                {memo.action_type === 'Consultation' && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                        <span className="text-[10px] font-bold text-purple-600 truncate">From: {memo.forwarded_by}</span>
                                                    </>
                                                )}
                                                {memo.is_budget_memo === 1 && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                        <span className="text-emerald-600 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                                                            <Wallet size={12} className="shrink-0" />
                                                            Budget
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1 shrink-0 mt-2" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                {/* Received Actions Column */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-base font-black text-[#1a365d] flex items-center gap-3 font-outfit uppercase tracking-wider">
                            <Bell className="text-emerald-500" size={20} />
                            Academic Inbox
                        </h2>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                            {distributedMemos.filter(m => !m.acknowledged_at).length} Unread
                        </span>
                    </div>

                    <div className="space-y-4">
                        {distributedMemos.length === 0 ? (
                            <div className="bg-white border border-slate-200 border-dashed rounded-[2rem] p-16 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <Inbox size={32} />
                                </div>
                                <p className="text-slate-400 font-bold text-sm">No distributed memos for your inbox.</p>
                            </div>
                        ) : (
                            distributedMemos.map(memo => (
                                <Link
                                    key={memo.id}
                                    href={`/dashboard/memos/${memo.uuid}`}
                                    className={cn(
                                        "block bg-white border border-slate-200 rounded-3xl p-6 transition-all group",
                                        !memo.acknowledged_at ? "border-l-4 border-l-emerald-500 shadow-sm" : "opacity-60 grayscale-[0.5]"
                                    )}
                                >
                                    <div className="flex items-start gap-5">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0",
                                            !memo.acknowledged_at ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                                        )}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="flex-grow min-w-0 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    {memo.reference_number} • {formatDate(memo.created_at)}
                                                </span>
                                                {memo.acknowledged_at && (
                                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg uppercase tracking-[0.2em]">
                                                        Acknowledged
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{memo.title}</h4>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                                    memo.memo_type === 'Action' ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                )}>
                                                    Type: {memo.memo_type}
                                                </span>
                                                {memo.is_budget_memo === 1 && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                                                        <Wallet size={10} className="shrink-0" />
                                                        Budget Requisition
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold text-slate-400 truncate">From {memo.creator_name}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-1 shrink-0 mt-2" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </section>
            </div >

            {/* ─── NEW: Institutional Tracking (For Managers/Reviewers) ─── */}
            < section className="space-y-6 pt-10 border-t border-slate-100" >
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <h2 className="text-base font-black text-[#1a365d] flex items-center gap-3 font-outfit uppercase tracking-wider">
                            <History className="text-blue-400" size={20} />
                            My Processing History
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-8 leading-none">Tracking progress of your past decisions</p>
                    </div>
                </div>

                {
                    processedApprovals.length === 0 ? (
                        <div className="bg-white border border-slate-200 border-dashed rounded-[2rem] p-12 text-center">
                            <p className="text-slate-400 font-bold text-sm">No recently processed memos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {processedApprovals.map(memo => (
                                <Link
                                    key={memo.id}
                                    href={`/dashboard/memos/${memo.uuid}`}
                                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-500 transition-all group relative overflow-hidden flex flex-col justify-between"
                                >
                                    <div className={cn(
                                        "absolute top-0 right-0 w-1 bg-emerald-500 h-full",
                                        memo.my_decision === 'Rejected' && "bg-red-500"
                                    )}></div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {memo.reference_number}
                                            </span>
                                            <div className="flex gap-1.5">
                                                <span className={cn(
                                                    "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest",
                                                    memo.my_decision === 'Approved' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                                )}>
                                                    You: {memo.my_decision}
                                                </span>
                                            </div>
                                        </div>

                                        <h4 className="font-bold text-[#1a365d] group-hover:text-blue-600 transition-colors uppercase tracking-tight line-clamp-1">
                                            {memo.title}
                                        </h4>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                                    {memo.creator_name[0]}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500">{memo.creator_name}</span>
                                            </div>
                                            <div className={cn(
                                                "text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider",
                                                memo.status === 'Draft' && "bg-slate-50 border-slate-200 text-slate-400",
                                                memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                                !['Draft', 'Distributed'].includes(memo.status) && "bg-blue-50 border-blue-200 text-blue-700"
                                            )}>
                                                Current: {memo.status}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                }
            </section >
        </div >
    );
}

