'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MemoSuggestion {
    uuid: string;
    title: string;
    reference_number?: string | null;
    creator_name?: string | null;
}

interface ListProps {
    items: MemoSuggestion[];
    query: string;
    loading: boolean;
    command: (item: { id: string; label: string }) => void;
}

interface ListHandle {
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const SuggestionList = forwardRef<ListHandle, ListProps>(function SuggestionList({ items, query, loading, command }, ref) {
    const [selected, setSelectedState] = useState(0);
    // Mirror in a ref: fast ArrowDown+Enter must not read a highlight from before the re-render
    const selectedRef = useRef(0);
    const setSelected = (i: number) => { selectedRef.current = i; setSelectedState(i); };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset highlight when results change
    useEffect(() => { selectedRef.current = 0; setSelectedState(0); }, [items]);

    const choose = (i: number) => {
        const item = items[i];
        if (item) command({ id: item.uuid, label: item.title });
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (!items.length) return false;
            const current = selectedRef.current;
            if (event.key === 'ArrowDown') { setSelected((current + 1) % items.length); return true; }
            if (event.key === 'ArrowUp') { setSelected((current - 1 + items.length) % items.length); return true; }
            if (event.key === 'Enter' || event.key === 'Tab') { choose(current); return true; }
            return false;
        },
    }));

    return (
        <div className="w-[min(28rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-xl shadow-xl shadow-[#0b2a5b]/15 overflow-hidden font-sans">
            <p className="px-3.5 pt-2.5 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                {query ? 'Reference a memo' : 'Recent memos'}
            </p>
            {items.length === 0 ? (
                <div className="px-3.5 pb-3 pt-1 text-sm text-slate-400 flex items-center gap-2">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Searching…</> : <>No memos match &ldquo;{query}&rdquo;</>}
                </div>
            ) : (
                <div className="p-1.5 pt-0 max-h-72 overflow-y-auto" role="listbox">
                    {items.map((item, i) => (
                        <button
                            key={item.uuid}
                            type="button"
                            role="option"
                            aria-selected={i === selected}
                            onMouseEnter={() => setSelected(i)}
                            // mousedown keeps editor focus so the command lands at the caret
                            onMouseDown={e => { e.preventDefault(); choose(i); }}
                            className={cn(
                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                                i === selected ? "bg-[#eef3fa]" : "hover:bg-slate-50"
                            )}
                        >
                            <FileText size={15} className="shrink-0 text-[#1a5aa6]" />
                            <span className="min-w-0 flex-1 flex items-baseline gap-2">
                                <span className="truncate text-sm font-semibold text-[#0b2a5b]">{item.title}</span>
                                {item.creator_name && (
                                    <span className="shrink-0 max-w-[45%] truncate text-xs text-slate-400">{item.creator_name}</span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <p className="px-3.5 py-1.5 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-400">
                ↑↓ to move · Enter to insert · Esc to dismiss
            </p>
        </div>
    );
});

// Debounced fetch shared by keystrokes. A superseded call returns the last good results
// (instead of an empty list) so the dropdown doesn't flash "no matches" while typing.
let searchSeq = 0;
let lastResults: MemoSuggestion[] = [];
async function fetchSuggestions(q: string): Promise<MemoSuggestion[]> {
    const seq = ++searchSeq;
    await new Promise(r => setTimeout(r, 200));
    if (seq !== searchSeq) return lastResults;
    try {
        const res = await fetch(`/api/memos/reference-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== searchSeq) return lastResults;
        lastResults = data.results || [];
        return lastResults;
    } catch {
        return lastResults;
    }
}

function place(el: HTMLElement, rect: DOMRect | null | undefined) {
    if (!rect) return;
    const width = el.offsetWidth || 448;
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const below = rect.bottom + 6;
    const fitsBelow = below + (el.offsetHeight || 300) < window.innerHeight;
    el.style.left = `${left}px`;
    el.style.top = fitsBelow ? `${below}px` : `${Math.max(16, rect.top - (el.offsetHeight || 300) - 6)}px`;
}

/**
 * "@" memo references. Typing "@" then part of a memo title lists matching memos (with
 * the submitter's name greyed out); choosing one inserts a link to that memo.
 * Stored as <a class="memo-ref" data-memo-ref="{uuid}" href="/dashboard/memos/{uuid}">@Title</a>.
 */
export const MemoReference = Mention.extend({
    name: 'memoReference',

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: el => el.getAttribute('data-memo-ref'),
                renderHTML: attrs => ({ 'data-memo-ref': attrs.id }),
            },
            label: {
                default: null,
                parseHTML: el => el.getAttribute('data-label') || el.textContent?.replace(/^@/, '') || null,
                renderHTML: attrs => ({ 'data-label': attrs.label }),
            },
            // Read by Mention's Backspace handling; not written to the HTML
            mentionSuggestionChar: { default: '@', rendered: false },
        };
    },

    // Above the Link mark so saved references reload as references, not plain links
    parseHTML() {
        return [{ tag: 'a[data-memo-ref]', priority: 1001 }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'a',
            { ...HTMLAttributes, href: `/dashboard/memos/${node.attrs.id}`, class: 'memo-ref' },
            `@${node.attrs.label ?? ''}`,
        ];
    },

    renderText({ node }) {
        return `@${node.attrs.label ?? ''}`;
    },
}).configure({
    // Backspace removes the whole reference rather than turning it back into "@"
    deleteTriggerWithBackspace: true,
    suggestion: {
        char: '@',
        // Titles have spaces, so keep matching across words
        allowSpaces: true,
        items: ({ query }) => fetchSuggestions(query.trim()),
        render: () => {
            let renderer: ReactRenderer<ListHandle, ListProps> | null = null;
            let el: HTMLDivElement | null = null;

            const propsFor = (p: SuggestionProps<MemoSuggestion>, loading: boolean): ListProps => ({
                items: p.items,
                query: p.query.trim(),
                loading,
                command: item => p.command(item),
            });

            return {
                onStart: props => {
                    renderer = new ReactRenderer(SuggestionList, { props: propsFor(props, false), editor: props.editor });
                    el = document.createElement('div');
                    el.style.position = 'fixed';
                    el.style.zIndex = '60';
                    el.appendChild(renderer.element);
                    document.body.appendChild(el);
                    requestAnimationFrame(() => el && place(el, props.clientRect?.()));
                },
                onUpdate: props => {
                    renderer?.updateProps(propsFor(props, false));
                    if (el) place(el, props.clientRect?.());
                },
                onKeyDown: props => {
                    if (props.event.key === 'Escape') {
                        el?.remove();
                        return true;
                    }
                    return renderer?.ref?.onKeyDown(props) ?? false;
                },
                onExit: () => {
                    el?.remove();
                    renderer?.destroy();
                    el = null;
                    renderer = null;
                },
            };
        },
    },
});
