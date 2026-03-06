export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import {
    Clock,
    ChevronRight,
    FileText,
    AlertCircle
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export default async function ApprovalsPage() {
    const session = await auth();
    if (!session?.user) return null;

    // Fetch memos where the current user is a pending approver
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
        [session.user.id]
    ) as any[];

    // Fetch memos processed by the current user
    const processedApprovals = await query(
        `SELECT m.*, u.username as creator_name, a.status as my_decision, a.processed_at
     FROM memos m
     JOIN memo_approvals a ON m.id = a.memo_id
     JOIN memo_system_users u ON m.created_by = u.id
     WHERE a.approver_id = ? AND a.status IN ('Approved', 'Rejected')
     ORDER BY a.processed_at DESC
     LIMIT 15`,
        [session.user.id]
    ) as any[];

    return (
        <div className="space-y-12 pb-20">
            {/* Pending Section */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight flex items-center gap-3">
                        <Clock className="text-blue-500" size={24} />
                        Pending Approvals
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Memos waiting for your review and approval.</p>
                </div>

                {pendingApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white border rounded-2xl border-dashed">
                        <Clock size={40} className="text-slate-200 mb-4" />
                        <p className="text-slate-400 font-medium text-sm">No pending approvals at the moment.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pendingApprovals.map((item) => (
                            <Link
                                key={item.approval_id}
                                href={`/dashboard/memos/${item.uuid}`}
                                className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-500 transition-all hover:shadow-md flex items-center justify-between"
                            >
                                <div className="flex items-center gap-5 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                        <FileText size={20} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5 text-[9px]">
                                            <span className="font-mono text-slate-400 uppercase">{item.reference_number}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="font-black text-blue-600 uppercase tracking-widest">Step {item.step_order}</span>
                                        </div>
                                        <h3 className="font-black text-[#1a365d] font-outfit text-base truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                            {item.title}
                                        </h3>
                                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 font-medium mt-0.5">
                                            <span className="uppercase tracking-wider">From: <span className="font-bold text-slate-700">{item.creator_name}</span></span>
                                            <span className="hidden sm:inline">•</span>
                                            <span className="uppercase tracking-wider">{item.department}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Received</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{formatDate(item.created_at)}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform group-hover:text-blue-500" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Processed Section */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-black text-slate-800 font-outfit uppercase tracking-tight flex items-center gap-3">
                        <FileText className="text-emerald-500" size={24} />
                        My Processing History
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Memos you have already reviewed and their current status.</p>
                </div>

                {processedApprovals.length === 0 ? (
                    <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center">
                        <p className="text-slate-400 font-bold text-sm">You haven't processed any memos yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {processedApprovals.map((item) => (
                            <Link
                                key={item.id}
                                href={`/dashboard/memos/${item.uuid}`}
                                className="group bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-blue-500 transition-all hover:shadow-md flex items-center justify-between"
                            >
                                <div className="flex items-center gap-5 overflow-hidden">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        item.my_decision === 'Approved' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                    )}>
                                        <FileText size={20} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5 text-[9px]">
                                            <span className="font-mono text-slate-400 uppercase">{item.reference_number}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className={cn(
                                                "font-black uppercase tracking-widest",
                                                item.my_decision === 'Approved' ? "text-emerald-600" : "text-red-600"
                                            )}>Your Action: {item.my_decision}</span>
                                        </div>
                                        <h3 className="font-black text-slate-700 font-outfit text-base truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                            {item.title}
                                        </h3>
                                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 font-medium mt-0.5">
                                            <span className="uppercase tracking-wider">Status: <span className="font-bold text-blue-600">{item.status}</span></span>
                                            <span className="hidden sm:inline">•</span>
                                            <span className="uppercase tracking-wider truncate max-w-[150px]">From: {item.creator_name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Processed</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{formatDate(item.processed_at)}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform group-hover:text-blue-500" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
