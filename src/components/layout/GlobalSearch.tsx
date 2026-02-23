'use client';

import { useState } from 'react';
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

export default function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const ref = useClickAway(() => setIsOpen(false));

    const handleSearch = async (value: string) => {
        setQuery(value);
        if (value.length < 3) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setIsOpen(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
            const data = await response.json();
            setResults(data.results || []);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative w-full max-w-md" ref={ref as any}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => query.length >= 3 && setIsOpen(true)}
                    placeholder="Search memos, reference no..."
                    className="w-full bg-muted/50 border rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[400px] overflow-auto">
                        {isLoading ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="animate-spin" />
                                <p className="text-xs">Searching...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="p-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Memos</p>
                                {results.map((result) => (
                                    <Link
                                        key={result.id}
                                        href={`/dashboard/memos/${result.uuid}`}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent group transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <FileText size={16} />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{result.title}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{result.reference_number}</p>
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                    </Link>
                                ))}
                            </div>
                        ) : query.length >= 3 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground italic">
                                No results found for "{query}"
                            </div>
                        ) : null}
                    </div>
                    {results.length > 0 && (
                        <div className="p-3 border-t bg-muted/20 text-center">
                            <p className="text-[10px] text-muted-foreground italic">Press enter or click and result to view memo details</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
