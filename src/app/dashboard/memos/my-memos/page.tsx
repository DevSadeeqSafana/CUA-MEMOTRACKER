import { auth } from '@/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import {
    FileText,
    Clock,
    ChevronRight,
    FileEdit,
    Wallet,
    Pencil,
    AlertTriangle
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export default async function MyMemosPage() {
    const session = await auth();
    if (!session?.user) return null;

    const memos = await query(
        `SELECT m.*,
                (SELECT COUNT(*) FROM memo_budget_info bi WHERE bi.memo_id = m.id) > 0 as is_budget_memo,
                (SELECT COUNT(*) FROM memo_approvals a WHERE a.memo_id = m.id AND a.status = 'Rejected') > 0 as is_rejected
         FROM memos m
         WHERE created_by = ?
         ORDER BY created_at DESC`,
        [session.user.id]
    ) as any[];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">My Memos</h2>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Manage and track your created memos.</p>
                </div>
            </div>

            {memos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-xl border-dashed">
                    <FileText size={48} className="text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">You haven't created any memos yet.</p>
                    <Link
                        href="/dashboard/memos/new"
                        className="mt-4 text-primary font-semibold hover:underline"
                    >
                        Create your first memo
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4">
                    {memos.map((memo) => {
                        // Needs attention: Draft + has a rejection record = unlocks edit
                        const needsAttention = memo.status === 'Draft' && memo.is_rejected === 1;

                        return (
                            <div
                                key={memo.id}
                                className={cn(
                                    'group bg-white border rounded-xl p-3 md:p-4 transition-all flex items-center gap-3 md:gap-4',
                                    needsAttention
                                        ? 'border-amber-300 hover:border-amber-400 hover:shadow-md shadow-sm shadow-amber-100'
                                        : 'border-slate-200 hover:border-blue-500 hover:shadow-md'
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                                    needsAttention
                                        ? 'bg-amber-100 text-amber-600'
                                        : memo.status === 'Draft'
                                            ? 'bg-slate-100 text-slate-400'
                                            : 'bg-blue-50 text-blue-600'
                                )}>
                                    {needsAttention
                                        ? <AlertTriangle size={20} />
                                        : memo.status === 'Draft'
                                            ? <FileEdit size={20} />
                                            : <FileText size={20} />
                                    }
                                </div>

                                {/* Content — links to detail page */}
                                <Link
                                    href={`/dashboard/memos/${memo.uuid}`}
                                    className="flex-grow min-w-0"
                                >
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[9px] font-bold font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase">
                                            {memo.reference_number}
                                        </span>
                                        <span className={cn(
                                            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                                            memo.priority === 'High' ? 'bg-destructive/10 text-destructive' :
                                                memo.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-blue-100 text-blue-700'
                                        )}>
                                            {memo.priority}
                                        </span>
                                        {needsAttention && (
                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">
                                                Needs Attention
                                            </span>
                                        )}
                                    </div>
                                    <h3 className={cn(
                                        'font-black font-outfit text-base truncate transition-colors uppercase tracking-tight',
                                        needsAttention ? 'text-amber-700 group-hover:text-amber-800' : 'text-[#1a365d] group-hover:text-blue-600'
                                    )}>
                                        {memo.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                                        <span className="flex items-center gap-1 uppercase tracking-wider">
                                            <Clock size={12} />
                                            {formatDate(memo.created_at)}
                                        </span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="uppercase tracking-wider hidden sm:inline">{memo.department}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="uppercase tracking-wider">{memo.memo_type}</span>
                                        {memo.is_budget_memo === 1 && (
                                            <>
                                                <span>•</span>
                                                <span className="text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <Wallet size={12} className="shrink-0" />
                                                    Budget
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </Link>

                                {/* Right side: status badge + action */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <div className={cn(
                                        'text-[8px] md:text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider whitespace-nowrap',
                                        needsAttention
                                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                                            : memo.status === 'Draft'  ? 'bg-slate-50 border-slate-200 text-slate-400'
                                            : memo.status === 'Line Manager Review' ? 'bg-amber-50 border-amber-200 text-amber-700'
                                            : memo.status === 'Reviewer Approval'  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : memo.status === 'Distributed'        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : memo.status === 'Archived'           ? 'bg-gray-100 border-gray-200 text-gray-500'
                                            : ''
                                    )}>
                                        <span className="hidden sm:inline">
                                            {needsAttention ? 'Rejected' : memo.status}
                                        </span>
                                        <span className="sm:hidden">
                                            {needsAttention ? 'Rejected' : memo.status.split(' ')[0]}
                                        </span>
                                    </div>

                                    {/* Direct Edit link for rejected memos */}
                                    {needsAttention ? (
                                        <Link
                                            href={`/dashboard/memos/${memo.uuid}/edit`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm shadow-amber-500/20"
                                        >
                                            <Pencil size={10} />
                                            Edit
                                        </Link>
                                    ) : (
                                        <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform group-hover:text-blue-500" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
