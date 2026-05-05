
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSort?: string;
    currentOrder?: 'asc' | 'desc';
    className?: string;
}

export default function SortableHeader({
    label,
    sortKey,
    currentSort,
    currentOrder,
    className
}: SortableHeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isActive = currentSort === sortKey;

    const handleSort = () => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (isActive) {
            params.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
        } else {
            params.set('sort', sortKey);
            params.set('order', 'asc');
        }
        
        router.push(`?${params.toString()}`);
    };

    return (
        <th className={cn("px-4 md:px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 cursor-pointer group select-none", className)} onClick={handleSort}>
            <div className="flex items-center gap-2">
                {label}
                <div className="flex flex-col text-slate-300 group-hover:text-slate-500 transition-colors">
                    {isActive ? (
                        currentOrder === 'asc' ? (
                            <ChevronUp size={12} className="text-blue-500" />
                        ) : (
                            <ChevronDown size={12} className="text-blue-500" />
                        )
                    ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                    )}
                </div>
            </div>
        </th>
    );
}
