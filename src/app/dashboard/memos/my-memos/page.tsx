import { auth } from '@/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import {
    FileText,
    Clock,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    FileEdit
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export default async function MyMemosPage() {
    const session = await auth();
    if (!session?.user) return null;

    const memos = await query(
        'SELECT * FROM memos WHERE created_by = ? ORDER BY created_at DESC',
        [session.user.id]
    ) as any[];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">My Memos</h2>
                    <p className="text-muted-foreground">Manage and track your created memos.</p>
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
                    {memos.map((memo) => (
                        <Link
                            key={memo.id}
                            href={`/dashboard/memos/${memo.uuid}`}
                            className="group bg-card border rounded-xl p-5 hover:border-primary/50 transition-all hover:shadow-md flex items-center gap-6"
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                                memo.status === 'Draft' ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                            )}>
                                {memo.status === 'Draft' ? <FileEdit size={24} /> : <FileText size={24} />}
                            </div>

                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                        {memo.reference_number}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                        memo.priority === 'High' ? "bg-destructive/10 text-destructive" :
                                            memo.priority === 'Medium' ? "bg-amber-100 text-amber-700" :
                                                "bg-blue-100 text-blue-700"
                                    )}>
                                        {memo.priority}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                    {memo.title}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {formatDate(memo.created_at)}
                                    </span>
                                    <span>•</span>
                                    <span>{memo.department}</span>
                                    <span>•</span>
                                    <span>{memo.memo_type}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className={cn(
                                    "text-xs font-semibold px-3 py-1 rounded-full border",
                                    memo.status === 'Draft' && "bg-muted border-border text-muted-foreground",
                                    memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                                    memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                                    memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                    memo.status === 'Archived' && "bg-gray-100 border-gray-200 text-gray-500",
                                )}>
                                    {memo.status}
                                </div>
                                <ChevronRight size={20} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
