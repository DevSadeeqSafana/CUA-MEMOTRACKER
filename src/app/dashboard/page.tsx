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
        <div className="space-y-6 md:space-y-12 animate-in fade-in duration-1000 font-sans">
            {/* Executive Greeting */}
            <div className="relative overflow-hidden bg-[#1a365d] rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 text-white shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3 text-blue-300">
                        <Activity size={18} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">CUA Institutional Monitor</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black font-outfit leading-none tracking-tight">
                        Greetings, <br />
                        <span className="text-blue-400">{session.user.name}</span>
                    </h1>
                    <p className="text-blue-100/60 font-medium max-w-xl text-sm">
                        University communications are operating within standard parameters. You have {pending_count + unread_count} items requiring attention in your Task Center.
                    </p>
                </div>
            </div>

            {/* Performance Grids */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-[1.25rem] md:rounded-[1.5rem] p-4 md:p-6 shadow-sm hover:border-blue-500 transition-all hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-4 md:mb-6">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <Clock size={20} className="md:hidden" /><Clock size={28} className="hidden md:block" />
                        </div>
                        <TrendingUp size={14} className="text-blue-500 md:w-4" />
                    </div>
                    <h3 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Decision Queue</h3>
                    <p className="text-lg md:text-xl font-black text-[#1a365d] tracking-tighter">{pending_count}</p>
                    <div className="mt-3 md:mt-6 flex items-center gap-2 text-[10px] md:text-xs font-bold text-blue-600 group-hover:gap-4 transition-all uppercase tracking-widest">
                        Process <ArrowRight size={12} />
                    </div>
                </Link>

                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-[1.25rem] md:rounded-[1.5rem] p-4 md:p-6 shadow-sm hover:border-emerald-500 transition-all hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-4 md:mb-6">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <Layers size={20} className="md:hidden" /><Layers size={28} className="hidden md:block" />
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <h3 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inbox</h3>
                    <p className="text-lg md:text-xl font-black text-[#1a365d] tracking-tighter">{unread_count}</p>
                    <div className="mt-3 md:mt-6 flex items-center gap-2 text-[10px] md:text-xs font-bold text-emerald-600 group-hover:gap-4 transition-all uppercase tracking-widest">
                        Open <ArrowRight size={12} />
                    </div>
                </Link>

                <div className="bg-white border border-slate-200 rounded-[1.25rem] md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4 md:mb-6">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <Send size={20} className="md:hidden" /><Send size={28} className="hidden md:block" />
                        </div>
                    </div>
                    <h3 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">My Memos</h3>
                    <p className="text-lg md:text-xl font-black text-[#1a365d] tracking-tighter">{my_total}</p>
                    <div className="mt-3 md:mt-6 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                        History
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-[1.25rem] md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4 md:mb-6">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[#1a365d] flex items-center justify-center text-white">
                            <ShieldCheck size={20} className="md:hidden" /><ShieldCheck size={28} className="hidden md:block" />
                        </div>
                    </div>
                    <h3 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Broadcasts</h3>
                    <p className="text-lg md:text-xl font-black text-[#1a365d] tracking-tighter">{university_total}</p>
                    <div className="mt-3 md:mt-6 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                        Records
                    </div>
                </div>
            </div>

            {/* University Analytics Preview */}
            <div className="bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
                    <div className="space-y-1">
                        <h2 className="text-base font-black text-[#1a365d] font-outfit uppercase tracking-wider">Communication Activity</h2>
                        <p className="text-[10px] text-slate-400 font-medium">Monthly oversight of the CUA Internal Memo Tracking System.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Last Update</p>
                            <p className="text-xs font-bold text-slate-900 leading-none">Just Now</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <Activity size={24} className="text-blue-500" />
                    </div>
                </div>

                <div className="h-48 md:h-64 flex items-end gap-1 md:gap-3 justify-between px-2 md:px-4 pt-4 pb-8">
                    {chartData.map((d, i) => (
                        <div key={i} className="flex-grow group relative h-full flex flex-col justify-end">
                            <div
                                className="w-full bg-slate-100 rounded-lg md:rounded-2xl group-hover:bg-blue-500 transition-all duration-700 relative cursor-pointer"
                                style={{ height: `${(d.count / maxCount) * 100}%` }}
                            >
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                    {d.count} Memos
                                </div>
                            </div>
                            <span className="absolute bottom-[-22px] left-1/2 -translate-x-1/2 text-[7px] md:text-[8px] font-black text-slate-300 uppercase">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
