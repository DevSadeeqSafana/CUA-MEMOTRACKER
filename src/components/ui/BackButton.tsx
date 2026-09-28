'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { canGoBackInApp } from '@/lib/nav-history';

/** Returns to the previous in-app page (Inbox, Action Queue, Finance Queue…), or `fallback` if there is none. */
export default function BackButton({ fallback, label = 'Back' }: { fallback: string, label?: string }) {
    const router = useRouter();
    return (
        <button
            type="button"
            onClick={() => (canGoBackInApp() ? router.back() : router.push(fallback))}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#0b2a5b] transition-all group px-3.5 py-2 bg-white border border-slate-200 hover:border-[#1a5aa6]/40 rounded-xl shadow-sm"
        >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            {label}
        </button>
    );
}
