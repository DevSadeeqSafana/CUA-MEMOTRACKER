import Link from 'next/link';
import Image from 'next/image';
import {
    FileText,
    PlusCircle,
    Inbox,
    CheckSquare,
    BarChart2,
    Settings,
    LogOut,
} from 'lucide-react';
import { auth, signOut } from '@/auth';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const userRoles = (session?.user as any)?.role || [];

    return (
        <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-72 border-r bg-[#1a365d] flex flex-col hidden md:flex text-white transition-all shadow-2xl">
                <div className="p-8 border-b border-white/10">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="bg-white p-1 rounded-lg">
                            <Image src="/CUALogo.png" alt="CUA Logo" width={32} height={32} className="object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg leading-tight">CUA IMTS</span>
                            <span className="text-[10px] opacity-60 uppercase tracking-widest font-bold">University Portal</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-grow p-6 space-y-2 overflow-y-auto">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-3 mb-4">Main Navigation</p>
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                        <Inbox size={20} className="opacity-70 group-hover:opacity-100" />
                        <span className="font-medium">Overview</span>
                    </Link>
                    <Link href="/dashboard/tasks" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                        <CheckSquare size={20} className="opacity-70 group-hover:opacity-100" />
                        <span className="font-medium">Task Center</span>
                    </Link>
                    {(userRoles.includes('Line Manager') || userRoles.includes('Reviewer')) && (
                        <Link href="/dashboard/approvals" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                            <PlusCircle size={20} className="opacity-70 group-hover:opacity-100 text-amber-400 rotate-45" />
                            <span className="font-medium">Signatures Queue</span>
                        </Link>
                    )}
                    <Link href="/dashboard/memos/new" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all border border-blue-400/20">
                        <PlusCircle size={20} />
                        <span>New Memo</span>
                    </Link>
                    <Link href="/dashboard/memos/my-memos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                        <FileText size={20} className="opacity-70 group-hover:opacity-100" />
                        <span className="font-medium">My Memos</span>
                    </Link>


                    <div className="pt-8" />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-3 mb-4">Administration</p>
                    {userRoles.includes('Administrator') && (
                        <>
                            <Link href="/dashboard/users" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                                <PlusCircle size={20} className="opacity-70 group-hover:opacity-100 text-emerald-400" />
                                <span className="font-medium">User Directory</span>
                            </Link>
                            <Link href="/dashboard/reports" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                                <BarChart2 size={20} className="opacity-70 group-hover:opacity-100" />
                                <span className="font-medium">Analytics & Reports</span>
                            </Link>
                        </>
                    )}
                    <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all group">
                        <Settings size={20} className="opacity-70 group-hover:opacity-100" />
                        <span className="font-medium">Account Settings</span>
                    </Link>
                </nav>

                <div className="p-6 border-t border-white/10 bg-black/10">
                    <div className="flex items-center gap-4 px-2 py-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10 font-black text-lg">
                            {session?.user?.name?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-bold truncate leading-none mb-1.5">{session?.user?.name}</p>
                            <div className="flex flex-wrap gap-1">
                                {userRoles.map((role: string) => (
                                    <span key={role} className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded text-[7px] font-black uppercase tracking-widest text-blue-200">
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <form action={async () => {
                        'use server';
                        await signOut();
                    }}>
                        <button className="flex items-center gap-3 w-full px-4 py-3 mt-2 rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all font-bold text-sm">
                            <LogOut size={18} />
                            Log Out
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col overflow-hidden bg-slate-50">
                {/* Page Content */}
                <div className="flex-grow overflow-auto p-10 scroll-smooth">
                    <div className="max-w-[1400px] mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
