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
import { canViewFinanceReports, getFinanceReport } from '@/lib/finance-report';
import PaymentsOverview from '@/components/dashboard/PaymentsOverview';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) return null;
    const userId = session.user.id;

    // Invoice amount, amount paid and outstanding balance: university-wide for Finance,
    // the VC and administrators; everyone else sees their own memos in the finance queue.
    const financeWide = canViewFinanceReports(session);

    // Headline counts and the finance summary load together (each is a round trip to the database)
    const [stats, finance] = await Promise.all([
        // High level metrics
        query(`
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
    `, [userId, userId, userId, userId, userId]) as Promise<any[]>,
        getFinanceReport(financeWide ? {} : { createdBy: Number(userId) }).catch(e => {
            console.error('Dashboard finance summary failed:', e);
            return null;
        }),
    ]);

    const { pending_count, unread_count, my_total, university_total } = stats[0];

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-1000 font-sans">
            {/* Greeting banner (doubles as the page header) */}
            <div className="relative overflow-hidden bg-[linear-gradient(115deg,#082352_0%,#0d3470_45%,#1a5aa6_80%,#2a6fbf_100%)] rounded-2xl px-5 py-5 md:px-7 md:py-6 text-white shadow-lg shadow-[#0b2a5b]/20">
                <div className="pointer-events-none absolute -right-16 -top-10 w-72 h-48 bg-[#6fa6e0]/30 blur-[80px] rounded-full" />
                <div className="pointer-events-none absolute -right-[10%] -top-[140%] w-[55%] aspect-square rounded-full border border-white/15" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2.5 text-blue-300">
                            <Activity size={14} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Overview</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-display leading-tight tracking-tight">
                            Greetings, <span className="text-[#a9d4f5]">{session.user.name}</span>
                        </h1>
                        <p className="text-blue-100/70 font-medium max-w-xl text-xs md:text-sm">
                            You have {pending_count + unread_count} item{pending_count + unread_count === 1 ? '' : 's'} requiring attention in your Memo Center.
                        </p>
                    </div>
                    <p className="text-[11px] font-semibold text-blue-100/60 shrink-0">
                        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })}
                    </p>
                </div>
            </div>

            {/* Performance Grids */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-500 transition-all">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-[#0b2a5b] group-hover:text-white transition-all">
                            <Clock size={20} />
                        </div>
                        <TrendingUp size={14} className="text-blue-500" />
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Decision Queue</h3>
                    <p className="text-2xl font-black text-[#0b2a5b] tracking-tighter">{pending_count}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 group-hover:gap-3 transition-all uppercase tracking-widest">
                        Process <ArrowRight size={12} />
                    </div>
                </Link>

                <Link href="/dashboard/tasks" className="group bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-emerald-500 transition-all">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <Layers size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inbox</h3>
                    <p className="text-2xl font-black text-[#0b2a5b] tracking-tighter">{unread_count}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 group-hover:gap-3 transition-all uppercase tracking-widest">
                        Open <ArrowRight size={12} />
                    </div>
                </Link>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                            <Send size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">My Memos</h3>
                    <p className="text-2xl font-black text-[#0b2a5b] tracking-tighter">{my_total}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        History
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#0b2a5b] flex items-center justify-center text-white">
                            <ShieldCheck size={20} />
                        </div>
                    </div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Sent</h3>
                    <p className="text-2xl font-black text-[#0b2a5b] tracking-tighter">{university_total}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Sent
                    </div>
                </div>
            </div>

            {finance && (financeWide || finance.kpis.memosInQueue > 0) && (
                <PaymentsOverview
                    scope={financeWide ? 'university' : 'mine'}
                    kpis={finance.kpis}
                    obligations={finance.topOutstanding.slice(0, 6)}
                    vendors={finance.byVendor.filter(v => v.vendorId !== null && v.outstanding > 0).slice(0, 5)}
                />
            )}
        </div>
    );
}
