'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    FileText,
    PlusCircle,
    Inbox,
    CheckSquare,
    BarChart2,
    Settings,
    LogOut,
    Menu,
    X,
    Star,
    AlertCircle,
    Send,
    Landmark,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSidebarCounts } from '@/lib/actions';
import { useTrackInAppNavigation } from '@/lib/nav-history';

function SealBadge({ size, className }: { size: number, className?: string }) {
    return (
        <div className={cn("shrink-0 rounded-full p-[3px] bg-[#e3ac3a] shadow-lg shadow-black/30", className)} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-[#0d2a5c]">
                <Image src="/CUALogo.png" alt="Cosmopolitan University seal" width={size} height={size} className="w-full h-full object-cover" />
            </div>
        </div>
    );
}

export default function Sidebar({ user, userRoles, handleSignOut }: { user: any, userRoles: string[], handleSignOut: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const folder = searchParams.get('folder') || 'inbox';

    const [counts, setCounts] = useState<{ inbox: number, important: number, actions: number, sent: number, drafts: number, accountant_queue?: number }>({
        inbox: 0, important: 0, actions: 0, sent: 0, drafts: 0, accountant_queue: 0
    });

    const fetchCounts = async () => {
        const result = await getSidebarCounts();
        setCounts(result);
    };

    useTrackInAppNavigation();

    // Mobile drawer: Esc closes it, and the page behind it doesn't scroll while open
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    // Close sidebar on path change (mobile)
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Poll counts every 10 seconds for instant real-time counts!
    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 10000);
        return () => clearInterval(interval);
    }, []);

    const navLinks = [
        { href: '/dashboard/memos/new', label: 'Compose', icon: PlusCircle, roles: [], isCompose: true },
        { href: '/dashboard', label: 'Overview', icon: CheckSquare, roles: [] },
        { href: '/dashboard/tasks?folder=inbox', label: 'Inbox', icon: Inbox, roles: [], badgeKey: 'inbox' as const },
        { href: '/dashboard/accountant', label: 'Finance Queue', icon: Landmark, roles: ['Accountant', 'Administrator'], badgeKey: 'accountant_queue' as const },
        { href: '/dashboard/tasks?folder=important', label: 'Important', icon: Star, roles: [], badgeKey: 'important' as const },
        { href: '/dashboard/tasks?folder=actions', label: 'Action Queue', icon: AlertCircle, roles: [], badgeKey: 'actions' as const },
        { href: '/dashboard/tasks?folder=sent', label: 'Sent Memos', icon: Send, roles: [], badgeKey: 'sent' as const },
        { href: '/dashboard/tasks?folder=drafts', label: 'Drafts', icon: FileText, roles: [], badgeKey: 'drafts' as const },
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
            <div className="md:hidden flex items-center justify-between bg-[linear-gradient(115deg,#082352_0%,#0d3470_60%,#1a5aa6_100%)] text-white px-4 shrink-0 transition-all z-40 fixed top-0 w-full h-16 shadow-lg">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <SealBadge size={40} />
                    <div className="flex flex-col">
                        <span className="font-display text-base leading-tight">Cosmopolitan University</span>
                        <span className="text-[10px] text-[#a9d4f5] tracking-wide">Internal Memo System</span>
                    </div>
                </Link>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={isOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isOpen}
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

            {/* Sidebar (Fixed Viewport Left) */}
            <aside className={cn(
                "fixed top-0 left-0 h-screen w-72 overflow-hidden bg-[linear-gradient(170deg,#082352_0%,#0d3470_55%,#14498f_100%)] flex flex-col text-white shadow-2xl shadow-[#0b2a5b]/30 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 rounded-none",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Soft glow and arc, echoing the login screen */}
                <div className="pointer-events-none absolute -right-24 top-1/3 w-56 h-72 bg-[#6fa6e0]/25 blur-[80px] rounded-full" />
                <div className="pointer-events-none absolute -left-[70%] -top-40 w-[190%] aspect-square rounded-full border border-white/10" />

                <div className="relative px-7 pt-8 pb-7 border-b border-white/10 hidden md:block shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-3.5 group">
                        <SealBadge size={56} className="group-hover:scale-105 transition-transform" />
                        <div className="flex flex-col">
                            <span className="font-display text-lg leading-[1.1]">Cosmopolitan<br />University</span>
                            <span className="mt-1.5 text-[9px] text-white/75 uppercase tracking-[0.16em] font-medium whitespace-nowrap">Internal Memo System</span>
                        </div>
                    </Link>
                </div>

                {/* Mobile close button inside sidebar */}
                <div className="relative md:hidden flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <span className="font-display text-xl text-white ml-2">Menu</span>
                    <button onClick={() => setIsOpen(false)} aria-label="Close menu" className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                <nav aria-label="Main" className="relative flex-grow p-6 space-y-1.5 overflow-y-auto scrollbar-hide">
                    <p className="text-[9px] font-medium text-[#a9d4f5]/70 uppercase tracking-[0.25em] px-3 mb-3">Main Navigation</p>

                    {navLinks.filter(l => canSeeLink(l.roles)).map(link => {
                        const Icon = link.icon;
                        
                        // Active folder / query param matching
                        const isCompose = link.isCompose;
                        const isActive = isCompose
                            ? pathname === link.href
                            : pathname === link.href.split('?')[0] && (link.href.includes('?folder=') ? folder === link.href.split('?folder=')[1] : true);

                        if (isCompose) {
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="group/compose flex items-center gap-3 w-full px-5 py-3.5 mt-1 mb-6 bg-white text-[#0b2a5b] hover:bg-slate-50 font-semibold rounded-xl shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] text-sm shrink-0"
                                >
                                    <PlusCircle size={18} className="text-[#1a5aa6]" />
                                    <span className="flex-1">Compose memo</span>
                                    <ArrowRight size={16} className="transition-transform group-hover/compose:translate-x-1" />
                                </Link>
                            );
                        }

                        return (
                            <Link key={link.href} href={link.href} aria-current={isActive ? 'page' : undefined} className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                                isActive ? "bg-white/[0.12] text-white border border-white/15 font-semibold" : "border border-transparent hover:bg-white/[0.07] text-white/80 hover:text-white font-medium"
                            )}>
                                <Icon size={18} className={cn(
                                    "transition-all shrink-0",
                                    isActive ? "opacity-100 text-[#a9d4f5]" : "opacity-70 group-hover:opacity-100"
                                )} />
                                <span className="text-sm">{link.label}</span>
                                {link.badgeKey && (counts[link.badgeKey] ?? 0) > 0 && (
                                    <span className="ml-auto bg-[#a9d4f5]/15 border border-[#a9d4f5]/25 text-[#a9d4f5] font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm shrink-0">
                                        {counts[link.badgeKey]}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    <div className="pt-8" />

                    {adminLinks.some(l => canSeeLink(l.roles)) && (
                        <>
                            <p className="text-[9px] font-medium text-[#a9d4f5]/70 uppercase tracking-[0.25em] px-3 mb-3">Administration</p>
                            {adminLinks.filter(l => canSeeLink(l.roles)).map(link => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;

                                return (
                                    <Link key={link.href} href={link.href} aria-current={isActive ? 'page' : undefined} className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                                        isActive ? "bg-white/[0.12] text-white border border-white/15" : "border border-transparent hover:bg-white/[0.07] text-white/80 hover:text-white"
                                    )}>
                                        <Icon size={18} className={cn(
                                            "transition-all shrink-0",
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
                    <Link href="/dashboard/settings" aria-current={pathname === '/dashboard/settings' ? 'page' : undefined} className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                        pathname === '/dashboard/settings' ? "bg-white/[0.12] text-white border border-white/15" : "border border-transparent hover:bg-white/[0.07] text-white/80 hover:text-white"
                    )}>
                        <Settings size={18} className={cn("shrink-0", pathname === '/dashboard/settings' ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                        <span className={cn("text-sm", pathname === '/dashboard/settings' ? "font-bold" : "font-medium")}>Account Settings</span>
                    </Link>
                </nav>

                <div className="relative p-6 border-t border-white/10 bg-black/15 shrink-0">
                    <div className="flex items-center gap-4 px-2 py-4">
                        <div className="w-12 h-12 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white ring-2 ring-[#e3ac3a]/80 font-display text-xl">
                            {user?.name?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-bold truncate leading-none mb-1.5">{user?.name}</p>
                            <div className="flex flex-wrap gap-1">
                                {userRoles.map((role: string) => (
                                    <span key={role} className="px-2 py-0.5 bg-[#a9d4f5]/10 border border-[#a9d4f5]/25 rounded-full text-[7px] font-black uppercase tracking-widest text-[#a9d4f5]">
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
