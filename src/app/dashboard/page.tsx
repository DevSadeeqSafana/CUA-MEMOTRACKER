export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
    Activity,
    CheckCircle2,
    Clock,
    Send,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    Layers
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) return null;
    const userId = session.user.id;

    // High level metrics
    const stats = await query(`
        SELECT 
            (
                (SELECT COUNT(*) FROM memo_approvals WHERE approver_id = ? AND status = 'Pending') +
                (SELECT COUNT(*) FROM memo_consultations c WHERE c.to_user_id = ? AND c.type = 'Forward' AND NOT EXISTS (
                    SELECT 1 FROM memo_consultations r WHERE r.parent_id = c.id AND r.from_user_id = ? AND r.type = 'Response'
                ))
            ) as pending_count,
            (SELECT COUNT(*) 
             FROM memo_recipients mr 
             JOIN memos m ON mr.memo_id = m.id 
             WHERE mr.recipient_id = ? AND mr.acknowledged_at IS NULL AND m.status = 'Distributed') as unread_count,
            (SELECT COUNT(*) FROM memos WHERE created_by = ?) as my_total,
            (SELECT COUNT(*) FROM memos WHERE status = 'Distributed') as university_total
    `, [userId, userId, userId, userId, userId]) as any[];

    const { pending_count, unread_count, my_total, university_total } = stats[0];

    // Communication Activity (Last 12 Months)
    const monthlyStats = await query(`
        SELECT 
            DATE_FORMAT(created_at, '%b %Y') as label,
            COUNT(*) as count
        FROM memos
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
        ORDER BY MIN(created_at) ASC
    `) as any[];

    // Ensure we have 12 bars (pad with 0 if needed)
    const chartData = monthlyStats.length > 0 ? monthlyStats : [
        { label: 'Jan', count: 40 }, { label: 'Feb', count: 70 }, { label: 'Mar', count: 45 },
        { label: 'Apr', count: 90 }, { label: 'May', count: 65 }, { label: 'Jun', count: 80 },
        { label: 'Jul', count: 55 }, { label: 'Aug', count: 100 }, { label: 'Sep', count: 85 },
        { label: 'Oct', count: 75 }, { label: 'Nov', count: 95 }, { label: 'Dec', count: 120 }
    ];

    // Normalize height (max 120 or highest count)
    const maxCount = Math.max(...chartData.map(d => d.count), 1);

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-1000 font-sans">
            {/* Standard Uniform Header Card */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-none">
                <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 bg-[#1a365d] text-white flex items-center justify-center font-bold shrink-0 rounded-none">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1a365d] font-outfit uppercase">System Overview</h1>
                        <p className="text-xs text-slate-500 font-medium">Internal memo tracker dashboard and institutional analytics.</p>
                    </div>
                </div>
            </div>

            {/* Executive Greeting Banner */}
            <div className="relative overflow-hidden bg-[#1a365d] rounded-none p-5 md:p-8 text-white shadow-sm border border-[#1a365d]">
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-3 text-blue-300">
                        <Activity size={16} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">CUA Institutional Monitor</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black font-outfit leading-none tracking-tight">
                        Greetings, <span className="text-blue-300">{session.user.name}</span>
                    </h2>
                    <p className="text-blue-100/70 font-medium max-w-xl text-xs md:text-sm">
                        University communications are operating within standard parameters. You have {pending_count + unread_count} items requiring attention in your Memo Center.
                    </p>
                </div>
            </div>

            {/* Performance Grids */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-none p-5 shadow-sm hover:border-blue-500 transition-all">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-none bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-[#1a365d] group-hover:text-white transition-all">
                            <Clock size={20} />
                        </div>
                        <TrendingUp size={14} className="text-blue-500" />
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Decision Queue</h3>
                    <p className="text-2xl font-black text-[#1a365d] tracking-tighter">{pending_count}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 group-hover:gap-3 transition-all uppercase tracking-widest">
                        Process <ArrowRight size={12} />
                    </div>
                </Link>

                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-none p-5 shadow-sm hover:border-emerald-500 transition-all">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-none bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <Layers size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inbox</h3>
                    <p className="text-2xl font-black text-[#1a365d] tracking-tighter">{unread_count}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 group-hover:gap-3 transition-all uppercase tracking-widest">
                        Open <ArrowRight size={12} />
                    </div>
                </Link>

                <div className="bg-white border border-slate-200 rounded-none p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-none bg-slate-50 flex items-center justify-center text-slate-500">
                            <Send size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">My Memos</h3>
                    <p className="text-2xl font-black text-[#1a365d] tracking-tighter">{my_total}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        History
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-none p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-none bg-[#1a365d] flex items-center justify-center text-white">
                            <ShieldCheck size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Broadcasts</h3>
                    <p className="text-2xl font-black text-[#1a365d] tracking-tighter">{university_total}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Broadcasted
                    </div>
                </div>
            </div>
        </div>
    );
}
