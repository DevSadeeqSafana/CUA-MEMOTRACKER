'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    FileText,
    PlusCircle,
    Inbox,
    CheckSquare,
    BarChart2,
    Settings,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar({ user, userRoles, handleSignOut }: { user: any, userRoles: string[], handleSignOut: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on path change (mobile)
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const navLinks = [
        { href: '/dashboard', label: 'Overview', icon: Inbox, roles: [] },
        { href: '/dashboard/tasks', label: 'Task Center', icon: CheckSquare, roles: [] },
        { href: '/dashboard/approvals', label: 'Signatures Queue', icon: PlusCircle, roles: ['Line Manager', 'Reviewer'], special: 'amber' },
        { href: '/dashboard/memos/new', label: 'New Memo', icon: PlusCircle, roles: [], isButton: true },
        { href: '/dashboard/memos/my-memos', label: 'My Memos', icon: FileText, roles: [] },
    ];

    const adminLinks = [
        { href: '/dashboard/users', label: 'User Directory', icon: PlusCircle, roles: ['Administrator'], special: 'emerald' },
        { href: '/dashboard/reports', label: 'Analytics & Reports', icon: BarChart2, roles: ['Administrator'] },
    ];

    const canSeeLink = (roles: string[]) => {
        if (roles.length === 0) return true;
        return roles.some(r => userRoles.includes(r));
    };

    return (
        <>
            {/* Mobile Header (Visible only on mobile) */}
            <div className="md:hidden flex items-center justify-between border-b bg-[#1a365d] text-white p-4 shrink-0 transition-all z-40 fixed top-0 w-full h-16 shadow-lg">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="bg-white p-1 rounded border border-white/20">
                        <Image src="/CUALogo.png" alt="CUA Logo" width={24} height={24} className="object-contain" />
                    </div>
                    <span className="font-black text-sm uppercase tracking-widest">CUA IMTS</span>
                </Link>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                >
                    {isOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed md:relative top-0 left-0 h-full w-72 bg-[#1a365d] flex flex-col text-white shadow-2xl z-50 transition-transform duration-300 ease-in-out md:translate-x-0 border-r border-[#1a365d]",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-8 border-b border-white/10 hidden md:block shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="bg-white p-1 rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-white/10">
                            <Image src="/CUALogo.png" alt="CUA Logo" width={32} height={32} className="object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-base leading-tight group-hover:text-blue-200 transition-colors">CUA IMTS</span>
                            <span className="text-[9px] opacity-60 uppercase tracking-widest font-bold">University Portal</span>
                        </div>
                    </Link>
                </div>

                {/* Mobile close button inside sidebar */}
                <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <span className="font-bold text-lg uppercase tracking-widest text-blue-200 ml-2">Menu</span>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-grow p-6 space-y-2 overflow-y-auto custom-scrollbar">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] px-3 mb-4">Main Navigation</p>

                    {navLinks.filter(l => canSeeLink(l.roles)).map(link => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;

                        if (link.isButton) {
                            return (
                                <Link key={link.href} href={link.href} className="flex items-center gap-3 px-4 py-3 mt-4 mb-2 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 hover:-translate-y-0.5 transition-all border border-blue-400/20 active:scale-95">
                                    <Icon size={20} className={cn(link.special === 'amber' ? 'text-amber-400 rotate-45' : '')} />
                                    <span className="text-sm">{link.label}</span>
                                </Link>
                            );
                        }

                        return (
                            <Link key={link.href} href={link.href} className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                                isActive ? "bg-white/15 text-white shadow-sm border border-white/5" : "hover:bg-white/10 text-white/80 hover:text-white"
                            )}>
                                <Icon size={20} className={cn(
                                    "transition-all",
                                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                                    link.special === 'amber' ? 'text-amber-400 rotate-45' : ''
                                )} />
                                <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>{link.label}</span>
                            </Link>
                        );
                    })}

                    <div className="pt-8" />

                    {adminLinks.some(l => canSeeLink(l.roles)) && (
                        <>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] px-3 mb-4">Administration</p>
                            {adminLinks.filter(l => canSeeLink(l.roles)).map(link => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;

                                return (
                                    <Link key={link.href} href={link.href} className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                                        isActive ? "bg-white/15 text-white shadow-sm border border-white/5" : "hover:bg-white/10 text-white/80 hover:text-white"
                                    )}>
                                        <Icon size={20} className={cn(
                                            "transition-all",
                                            isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                                            link.special === 'emerald' ? 'text-emerald-400' : ''
                                        )} />
                                        <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>{link.label}</span>
                                    </Link>
                                );
                            })}
                        </>
                    )}

                    <div className="pt-4" />
                    <Link href="/dashboard/settings" className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                        pathname === '/dashboard/settings' ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/80 hover:text-white"
                    )}>
                        <Settings size={20} className={cn(pathname === '/dashboard/settings' ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                        <span className={cn("text-sm", pathname === '/dashboard/settings' ? "font-bold" : "font-medium")}>Account Settings</span>
                    </Link>
                </nav>

                <div className="p-6 border-t border-white/10 bg-black/20 shrink-0">
                    <div className="flex items-center gap-4 px-2 py-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 shadow-inner font-black text-lg">
                            {user?.name?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-bold truncate leading-none mb-1.5">{user?.name}</p>
                            <div className="flex flex-wrap gap-1">
                                {userRoles.map((role: string) => (
                                    <span key={role} className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 shadow-sm rounded text-[7px] font-black uppercase tracking-widest text-blue-200">
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <form action={handleSignOut}>
                        <button className="flex items-center gap-3 w-full px-4 py-3 mt-2 rounded-xl text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all font-bold text-sm border border-transparent hover:border-red-500/30">
                            <LogOut size={18} />
                            Log Out
                        </button>
                    </form>
                </div>
            </aside>
        </>
    );
}
