'use client';

import { useEffect, useState } from 'react';
import {
    CheckCircle2, XCircle, User, FilePlus, Send, Landmark, Pencil, Paperclip,
    History, X, Forward, Reply, Shuffle, Download, Clock
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { AuditEvent, AuditEventType } from '@/lib/audit-trail';

const ICONS: Record<AuditEventType, typeof CheckCircle2> = {
    creation: FilePlus,
    approval: CheckCircle2,
    acknowledgment: CheckCircle2,
    rejection: XCircle,
    distribution: Send,
    routing: Shuffle,
    consultation: Forward,
    reply: Reply,
    finance: Landmark,
    revision: Pencil,
    attachment: Paperclip,
    download: Download,
};

/** "Audit Trail" button; opens the memo's complete history in a modal. */
export default function AuditTrailButton({ events, referenceNumber }: { events: AuditEvent[]; referenceNumber?: string | null }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0b2a5b] shadow-sm transition-colors hover:bg-slate-50"
            >
                <History size={13} />
                Audit Trail
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{events.length}</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="audit-trail-title"
                        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 id="audit-trail-title" className="font-display text-lg font-medium tracking-tight text-[#0b2a5b]">Audit Trail</h3>
                                <p className="break-all text-[10px] font-medium text-slate-400">
                                    {referenceNumber ? `Reference ${referenceNumber} · ` : ''}{events.length} recorded event{events.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                                <X size={16} />
                            </button>
                        </div>

                        <ol className="relative space-y-1 overflow-y-auto px-5 py-5">
                            {events.map(event => {
                                const Icon = event.status === 'pending' ? Clock : ICONS[event.type] ?? CheckCircle2;
                                return (
                                    <li key={event.id} className="group relative flex items-start gap-4 pb-5 last:pb-0">
                                        {/* connector line */}
                                        <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-0.5 bg-slate-100 group-last:hidden" />
                                        <div className={cn(
                                            'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-white shadow-sm',
                                            event.status === 'failed' ? 'bg-red-500 text-white'
                                                : event.status === 'pending' ? 'bg-amber-100 text-amber-600'
                                                : event.type === 'attachment' || event.type === 'reply' || event.type === 'consultation' ? 'bg-blue-600 text-white'
                                                : event.type === 'download' ? 'bg-slate-400 text-white'
                                                : 'bg-emerald-500 text-white'
                                        )}>
                                            <Icon size={14} />
                                        </div>
                                        <div className="min-w-0 flex-grow space-y-0.5 pt-0.5">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <h4 className={cn(
                                                    'text-xs font-black uppercase tracking-wider',
                                                    event.status === 'failed' ? 'text-red-700' : event.status === 'pending' ? 'text-amber-700' : 'text-[#0b2a5b]'
                                                )}>
                                                    {event.title}
                                                </h4>
                                                <span className="shrink-0 self-start rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400 sm:self-center">
                                                    {event.timestamp ? formatDate(event.timestamp) : 'Pending'}
                                                </span>
                                            </div>
                                            <p className="break-words text-xs font-medium leading-relaxed text-slate-500">{event.description}</p>
                                            {event.user && (
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                        <User size={8} />
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{event.user}</span>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>
            )}
        </>
    );
}
