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
    ShieldCheck
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
        `SELECT m.*, u.username as creator_name, a.id as approval_id, a.step_order 
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

    // 2. Distributed Memos (For Recipients / Receivers)
    const distributedMemos = await query(
        `SELECT m.*, u.username as creator_name, mr.read_at, mr.acknowledged_at
     FROM memos m
     JOIN memo_recipients mr ON m.id = mr.memo_id
     JOIN memo_system_users u ON m.created_by = u.id
     WHERE mr.recipient_id = ? AND m.status = 'Distributed'
     ORDER BY m.created_at DESC`,
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
                            {pendingApprovals.length} Required
                        </span>
                    </div>

                    <div className="space-y-4">
                        {pendingApprovals.length === 0 ? (
                            <div className="bg-white border border-slate-200 border-dashed rounded-[2rem] p-16 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <Clock size={32} />
                                </div>
                                <p className="text-slate-400 font-bold text-sm">Your decision queue is currently empty.</p>
                            </div>
                        ) : (
                            pendingApprovals.map(memo => (
                                <Link
                                    key={memo.approval_id}
                                    href={`/dashboard/memos/${memo.uuid}`}
                                    className="block bg-white border border-slate-200 rounded-3xl p-6 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/10 transition-all group"
                                >
                                    <div className="flex items-start gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1a365d] group-hover:bg-[#1a365d] group-hover:text-white transition-all shrink-0">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-grow min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-widest shrink-0">
                                                    Step {memo.step_order}
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
            </div>
        </div>
    );
}

