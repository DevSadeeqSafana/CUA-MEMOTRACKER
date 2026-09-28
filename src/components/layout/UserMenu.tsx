'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClickAway } from '@/hooks/use-click-away';

interface UserMenuProps {
    name?: string | null;
    email?: string | null;
    roles: string[];
    handleSignOut: () => void;
}

/** Top-bar account menu: avatar + name, with roles, settings and sign-out in the dropdown. */
export default function UserMenu({ name, email, roles, handleSignOut }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useClickAway(() => setIsOpen(false));
    const initial = name?.[0]?.toUpperCase() || 'U';

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen]);

    return (
        <div className="relative" ref={ref as React.RefObject<HTMLDivElement>}>
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`Account menu for ${name || 'user'}`}
                className={cn(
                    "flex items-center gap-2.5 h-11 pl-1.5 pr-2 md:pr-3 rounded-xl border transition-all",
                    isOpen ? "bg-[#eef3fa] border-[#1a5aa6]/30" : "bg-white border-slate-200 hover:border-[#1a5aa6]/40 shadow-sm"
                )}
            >
                <span className="w-8 h-8 shrink-0 rounded-full bg-[#0b2a5b] text-white flex items-center justify-center ring-2 ring-[#e3ac3a]/80 font-display text-base">
                    {initial}
                </span>
                <span className="hidden md:flex flex-col items-start min-w-0 max-w-[180px]">
                    <span className="text-sm font-semibold text-[#0b2a5b] truncate max-w-full leading-tight">{name}</span>
                    {roles[0] && <span className="text-[10px] text-slate-400 leading-tight">{roles[0]}{roles.length > 1 ? ` +${roles.length - 1}` : ''}</span>}
                </span>
                <ChevronDown size={15} className={cn("hidden md:block text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div role="menu" className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-[#0b2a5b]/15 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-5 flex items-center gap-3.5 bg-[linear-gradient(115deg,#082352_0%,#0d3470_60%,#1a5aa6_100%)] text-white">
                        <span className="w-12 h-12 shrink-0 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-[#e3ac3a]/80 font-display text-xl">
                            {initial}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            {email && <p className="text-[11px] text-white/70 truncate">{email}</p>}
                        </div>
                    </div>

                    {roles.length > 0 && (
                        <div className="px-5 py-3.5 border-b border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Roles</p>
                            <div className="flex flex-wrap gap-1.5">
                                {roles.map(role => (
                                    <span key={role} className="px-2 py-0.5 bg-[#eef3fa] border border-[#1a5aa6]/15 rounded-full text-[10px] font-semibold text-[#0b2a5b]">
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-2">
                        <Link
                            href="/dashboard/settings"
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0b2a5b] transition-colors"
                        >
                            <Settings size={17} />
                            Account Settings
                        </Link>
                        <form action={handleSignOut}>
                            <button
                                role="menuitem"
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut size={17} />
                                Log Out
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
