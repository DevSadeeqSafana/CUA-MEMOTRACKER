'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Building2, Check, Loader2, Mail, Pencil, Phone, Plus, Search, X } from 'lucide-react';
import { searchVendors } from '@/lib/vendor-actions';
import type { VendorOption } from '@/lib/vendor-data';
import VendorFormModal from './VendorFormModal';
import { cn } from '@/lib/utils';

interface Props {
    value: VendorOption | null;
    onChange: (vendor: VendorOption | null) => void;
    /** Finance users also enter bank details when registering a vendor here. */
    canManage?: boolean;
    placeholder?: string;
    className?: string;
    compact?: boolean;
    /** Hide email / phone in the suggestions and the selected card (names only). */
    hideContact?: boolean;
    /** Adds an "Other" choice for a payee that is not a registered vendor (replaces "Register"). */
    onOther?: () => void;
    otherLabel?: string;
}

/**
 * Combo box over the shared vendor list: type to search registered vendors, pick one,
 * or register a new vendor when it isn't listed.
 */
export default function VendorPicker({ value, onChange, canManage = false, placeholder = 'Search registered vendors…', className, compact, hideContact = false, onOther, otherLabel = 'Other (not on the list): enter details manually' }: Props) {
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<VendorOption[]>([]);
    const [active, setActive] = useState(0);
    const [creating, setCreating] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    // Debounced search; stale responses are ignored. (`loading` is switched on by the
    // input handlers that change `term` / `open`.)
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            const res = await searchVendors(term);
            if (cancelled) return;
            setOptions(res);
            setActive(0);
            setLoading(false);
        }, 200);
        return () => { cancelled = true; clearTimeout(t); };
    }, [term, open]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const choose = (v: VendorOption) => {
        onChange(v);
        setTerm('');
        setOpen(false);
    };

    const exact = options.some(o => o.name.trim().toLowerCase() === term.trim().toLowerCase());
    const showCreate = !onOther && term.trim().length >= 2 && !exact;
    const showOther = Boolean(onOther);
    const itemCount = options.length + (showCreate || showOther ? 1 : 0);
    const chooseOther = () => { setOpen(false); setTerm(''); onOther?.(); };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setLoading(true); } setActive(a => Math.min(a + 1, Math.max(itemCount - 1, 0))); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') {
            // Never let Enter submit the surrounding memo form from here.
            e.preventDefault();
            if (!open) return;
            if (active < options.length) { if (options[active]) choose(options[active]); }
            else if (showOther) chooseOther();
            else if (showCreate) { setOpen(false); setCreating(true); }
        } else if (e.key === 'Escape') { setOpen(false); }
    };

    if (value) {
        return (
            <div className={cn('flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5', className)}>
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"><Building2 size={14} /></div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0b2a5b]">{value.name}</p>
                    {!compact && !hideContact && (value.email || value.phone || value.address) && (
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-500">
                            {value.email && <span className="inline-flex items-center gap-1"><Mail size={10} />{value.email}</span>}
                            {value.phone && <span className="inline-flex items-center gap-1"><Phone size={10} />{value.phone}</span>}
                            {value.address && <span className="truncate">{value.address}</span>}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-white hover:text-red-500"
                    aria-label={`Remove vendor ${value.name}`}
                >
                    <span className="hidden sm:inline">Change</span><X size={14} className="sm:hidden" />
                </button>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className={cn('relative', className)}>
            <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    value={term}
                    onChange={e => { setTerm(e.target.value); setOpen(true); setLoading(true); }}
                    onFocus={() => { if (!open) { setOpen(true); setLoading(true); } }}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-[#1a5aa6] focus:bg-white focus:ring-4 focus:ring-[#1a5aa6]/10"
                />
                {loading && open && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-300" />}
            </div>

            {open && (
                <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10">
                    {!loading && options.length === 0 && showOther && term.trim() && (
                        <li className="px-4 py-2.5 text-xs font-medium text-slate-400">No registered vendor matches.</li>
                    )}
                    {!loading && options.length === 0 && !showCreate && !showOther && (
                        <li className="px-4 py-3 text-xs font-medium text-slate-400">
                            {term.trim() ? 'No registered vendor matches.' : 'No vendors registered yet. Type a name to add one.'}
                        </li>
                    )}
                    {options.map((o, i) => (
                        <li
                            key={o.id}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={e => { e.preventDefault(); choose(o); }}
                            onMouseEnter={() => setActive(i)}
                            className={cn('flex cursor-pointer items-center gap-3 px-3.5 py-2', i === active ? 'bg-blue-50' : 'hover:bg-slate-50')}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Building2 size={13} /></div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">{o.name}</p>
                                {!hideContact && (o.email || o.phone) && <p className="truncate text-[11px] text-slate-400">{[o.email, o.phone].filter(Boolean).join(' · ')}</p>}
                            </div>
                            {i === active && <Check size={14} className="shrink-0 text-blue-500" />}
                        </li>
                    ))}
                    {showOther && (
                        <li
                            role="option"
                            aria-selected={active === options.length}
                            onMouseDown={e => { e.preventDefault(); chooseOther(); }}
                            onMouseEnter={() => setActive(options.length)}
                            className={cn('flex cursor-pointer items-center gap-3 border-t border-slate-100 px-3.5 py-2.5', active === options.length ? 'bg-amber-50' : 'hover:bg-slate-50')}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"><Pencil size={13} /></div>
                            <p className="min-w-0 truncate text-sm font-semibold text-amber-700">{otherLabel}</p>
                        </li>
                    )}
                    {showCreate && (
                        <li
                            role="option"
                            aria-selected={active === options.length}
                            onMouseDown={e => { e.preventDefault(); setOpen(false); setCreating(true); }}
                            onMouseEnter={() => setActive(options.length)}
                            className={cn('flex cursor-pointer items-center gap-3 border-t border-slate-100 px-3.5 py-2.5', active === options.length ? 'bg-emerald-50' : 'hover:bg-slate-50')}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"><Plus size={14} /></div>
                            <p className="min-w-0 truncate text-sm font-semibold text-emerald-700">Register &ldquo;{term.trim()}&rdquo; as a new vendor</p>
                        </li>
                    )}
                </ul>
            )}

            {creating && (
                <VendorFormModal
                    initialName={term.trim()}
                    showBankFields={canManage}
                    onClose={() => setCreating(false)}
                    onSaved={v => { setCreating(false); choose(v); }}
                    onExisting={v => { setCreating(false); choose(v); }}
                />
            )}
        </div>
    );
}
