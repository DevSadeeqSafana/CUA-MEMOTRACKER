'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useClickAway } from '@/hooks/use-click-away';

interface SearchResult {
    id: number;
    uuid: string;
    title: string;
    reference_number: string;
    status: string;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

export default function GlobalSearch() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    // Only the latest request may update results, so slow responses can't overwrite newer ones
    const requestId = useRef(0);

    const ref = useClickAway(() => setIsOpen(false));

    // Debounced fetch
    useEffect(() => {
        const q = query.trim();
        if (q.length < MIN_CHARS) {
            requestId.current++;
            setResults([]);
            setIsLoading(false);
            return;
        }
        const id = ++requestId.current;
        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
                const data = await response.json();
                if (id === requestId.current) {
                    setResults(data.results || []);
                    setActiveIndex(0);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                if (id === requestId.current) setIsLoading(false);
            }
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    // Ctrl/Cmd+K or "/" focuses search from anywhere (except while typing in another field)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
            if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const open = (result: SearchResult) => {
        setIsOpen(false);
        inputRef.current?.blur();
        router.push(`/dashboard/memos/${result.uuid}`);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowDown' && results.length) {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex(i => (i + 1) % results.length);
        } else if (e.key === 'ArrowUp' && results.length) {
            e.preventDefault();
            setActiveIndex(i => (i - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            open(results[activeIndex]);
        }
    };

    const showDropdown = isOpen && query.trim().length >= MIN_CHARS;

    return (
        <div className="relative w-full max-w-lg" ref={ref as React.RefObject<HTMLDivElement>}>
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls="global-search-results"
                    aria-label="Search memos by title or reference number"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder="Search memos or reference no."
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-16 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1a5aa6]/20 focus:border-[#1a5aa6] transition-all [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                    <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0b2a5b]"
                    >
                        <X size={16} />
                    </button>
                ) : (
                    <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        Ctrl K
                    </kbd>
                )}
            </div>

            {showDropdown && (
                <div id="global-search-results" role="listbox" className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-[#0b2a5b]/10 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[400px] overflow-auto">
                        {isLoading && results.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                                <Loader2 className="animate-spin" />
                                <p className="text-xs">Searching…</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="p-2">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] px-3 py-2">Memos</p>
                                {results.map((result, i) => (
                                    <Link
                                        key={result.id}
                                        role="option"
                                        aria-selected={i === activeIndex}
                                        href={`/dashboard/memos/${result.uuid}`}
                                        onClick={() => setIsOpen(false)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg group transition-colors",
                                            i === activeIndex ? "bg-[#eef3fa]" : "hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-[#0b2a5b]/5 flex items-center justify-center text-[#0b2a5b] shrink-0">
                                            <FileText size={15} />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{result.title}</p>
                                            <p className="text-[11px] text-slate-400 font-mono truncate">{result.reference_number} · {result.status}</p>
                                        </div>
                                        <ArrowRight size={14} className={cn("text-[#1a5aa6] transition-all", i === activeIndex ? "opacity-100 translate-x-0.5" : "opacity-0")} />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-sm text-slate-400">
                                No memos match &ldquo;{query.trim()}&rdquo;
                            </div>
                        )}
                    </div>
                    {results.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-400 flex gap-4">
                            <span><kbd className="font-sans font-semibold">↑↓</kbd> to move</span>
                            <span><kbd className="font-sans font-semibold">Enter</kbd> to open</span>
                            <span><kbd className="font-sans font-semibold">Esc</kbd> to close</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
