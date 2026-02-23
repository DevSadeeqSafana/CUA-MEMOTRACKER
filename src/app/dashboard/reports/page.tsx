import { auth } from '@/auth';
import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import {
    BarChart2,
    Download,
    FileText,
    Users,
    Clock,
    TrendingUp,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import ExportButton from '@/components/reports/ExportButton';

export default async function ReportsPage() {
    const session = await auth();
    if (!session?.user) return null;

    // RBAC check: Only Administrator can access reports
    const isUserAdmin = (session.user as any).role?.includes('Administrator');
    if (!isUserAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-2xl shadow-sm text-center px-6">
                <AlertCircle size={48} className="text-destructive mb-4" />
                <h2 className="text-xl font-bold">Access Restricted</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Only administrators have access to system-wide reports and compliance metrics.
                    Please contact your IT department if you believe this is an error.
                </p>
            </div>
        );
    }

    // Fetch some metrics
    const totalMemosResult = await query('SELECT COUNT(*) as count FROM memos') as any[];
    const distributedMemosResult = await query('SELECT COUNT(*) as count FROM memos WHERE status = "Distributed"') as any[];
    const totalUsersResult = await query('SELECT COUNT(*) as count FROM memo_system_users') as any[];

    const totalMemos = totalMemosResult[0].count;
    const distributedMemos = distributedMemosResult[0].count;
    const totalUsers = totalUsersResult[0].count;

    // Lifecycle analytics
    const memoList = await query(
        `SELECT m.id, m.reference_number, m.title, m.status, m.department, m.created_at, u.username as creator_name
     FROM memos m
     JOIN memo_system_users u ON m.created_by = u.id
     ORDER BY m.created_at DESC`
    ) as any[];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Reports & Analytics</h1>
                <p className="text-muted-foreground mt-1">Detailed overview of memo lifecycle and organizational compliance.</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-primary font-bold">
                        <TrendingUp size={18} />
                        <span className="text-[10px] uppercase tracking-widest">Total Volume</span>
                    </div>
                    <h3 className="text-3xl font-bold">{totalMemos}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Memos generated to date</p>
                </div>
                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-emerald-600 font-bold">
                        <CheckCircle2 size={18} />
                        <span className="text-[10px] uppercase tracking-widest">Completed</span>
                    </div>
                    <h3 className="text-3xl font-bold">{distributedMemos}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Fully distributed memos</p>
                </div>
                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-blue-600 font-bold">
                        <Users size={18} />
                        <span className="text-[10px] uppercase tracking-widest">User Base</span>
                    </div>
                    <h3 className="text-3xl font-bold">{totalUsers}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Active system participants</p>
                </div>
                <div className="bg-card border rounded-2xl p-6 shadow-sm border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-3 mb-2 text-primary font-bold">
                        <Clock size={18} />
                        <span className="text-[10px] uppercase tracking-widest">Compliance Rate</span>
                    </div>
                    <h3 className="text-3xl font-bold">
                        {totalMemos > 0 ? Math.round((distributedMemos / totalMemos) * 100) : 0}%
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Successful lifecycle completion</p>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between bg-muted/20">
                    <h2 className="text-lg font-bold">Memo Lifecycle Distribution</h2>
                    <ExportButton data={memoList} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/10">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reference</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Memo Title</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {memoList.map((memo) => (
                                <tr key={memo.id} className="hover:bg-muted/5 transition-colors">
                                    <td className="px-6 py-4 text-xs font-mono font-medium">{memo.reference_number}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-foreground max-w-xs truncate">{memo.title}</td>
                                    <td className="px-6 py-4 text-xs font-medium">{memo.creator_name}</td>
                                    <td className="px-6 py-4 text-xs">
                                        <span className="px-2 py-1 bg-muted rounded text-muted-foreground font-semibold">
                                            {memo.department}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border",
                                            memo.status === 'Draft' && "bg-muted border-border text-muted-foreground",
                                            memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                                            memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                                            memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                        )}>
                                            {memo.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-right text-muted-foreground">
                                        {formatDate(memo.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {memoList.length === 0 && (
                    <div className="p-20 text-center italic text-muted-foreground text-sm">
                        No memos found in the system.
                    </div>
                )}
            </div>
        </div>
    );
}

