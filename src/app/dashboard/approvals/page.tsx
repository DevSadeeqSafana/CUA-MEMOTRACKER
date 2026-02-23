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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Pending Approvals</h2>
                <p className="text-muted-foreground">Memos waiting for your review and approval.</p>
            </div>

            {pendingApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-xl border-dashed">
                    <Clock size={48} className="text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">No pending approvals at the moment.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pendingApprovals.map((item) => (
                        <Link
                            key={item.approval_id}
                            href={`/dashboard/memos/${item.uuid}`}
                            className="group bg-card border rounded-xl p-5 hover:border-primary/50 transition-all hover:shadow-md flex items-center justify-between"
                        >
                            <div className="flex items-center gap-5 overflow-hidden">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <FileText size={24} />
                                </div>
                                <div className="overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1 text-xs">
                                        <span className="font-mono text-muted-foreground">{item.reference_number}</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="font-semibold text-primary">Step {item.step_order}</span>
                                    </div>
                                    <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <span>From: <span className="font-medium text-foreground">{item.creator_name}</span></span>
                                        <span>•</span>
                                        <span>{item.department}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-muted-foreground">Received on</p>
                                    <p className="text-sm font-medium">{formatDate(item.created_at)}</p>
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
