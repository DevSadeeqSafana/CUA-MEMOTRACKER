'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reply, ReplyAll, Forward, MessageSquareReply, Send, Loader2, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { postMemoReply, markMemoRepliesRead, searchUsersForConsultation } from '@/lib/actions';
import type { MemoReplyMessage, ReplyRecipientType } from '@/lib/actions';
import { isCommentEmpty } from '@/lib/rich-text';
import { cn, formatDate } from '@/lib/utils';
import CommentEditor from '@/components/memos/CommentEditor';
import CommentContent from '@/components/memos/CommentContent';

export interface ReplyPerson {
    id: number;
    name: string;
    department?: string | null;
}

type ComposeMode = 'reply' | 'replyAll' | 'forward';

interface ComposeState {
    mode: ComposeMode;
    title: string;
    parent: MemoReplyMessage | null;
    to: ReplyPerson[];
    cc: ReplyPerson[];
    bcc: ReplyPerson[];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const uniquePeople = (people: ReplyPerson[], exclude: number[] = []) => {
    const seen = new Set(exclude);
    return people.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
};

const namesOf = (m: MemoReplyMessage, type: ReplyRecipientType) => m.recipients.filter(r => r.type === type).map(r => r.name);

/** Quoted copy of a reply, appended to a forwarded message. */
function forwardedBlock(m: MemoReplyMessage) {
    const to = namesOf(m, 'To').join(', ');
    const cc = namesOf(m, 'CC').join(', ');
    return `<p>---------- Forwarded message ----------<br>From: ${escapeHtml(m.author_name)}<br>Date: ${escapeHtml(formatDate(m.created_at))}`
        + `${to ? `<br>To: ${escapeHtml(to)}` : ''}${cc ? `<br>Cc: ${escapeHtml(cc)}` : ''}</p><blockquote>${m.message}</blockquote>`;
}

// ─── Recipient picker (To / CC / BCC) ────────────────────────────────────────

function RecipientField({
    label,
    people,
    onChange,
    exclude,
    autoFocus = false
}: {
    label: string;
    people: ReplyPerson[];
    onChange: (people: ReplyPerson[]) => void;
    /** ids already used in another field */
    exclude: number[];
    autoFocus?: boolean;
}) {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<ReplyPerson[]>([]);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        if (term.trim().length < 2) { setResults([]); return; }
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const rows = await searchUsersForConsultation(term.trim());
                setResults((rows as { id: number; username: string; department: string | null }[]).map(u => ({ id: u.id, name: u.username, department: u.department })));
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [term]);

    const taken = new Set([...exclude, ...people.map(p => p.id)]);
    const options = results.filter(r => !taken.has(r.id));

    return (
        <div className="flex items-start gap-2 border-b border-slate-100 py-2">
            <span className="w-9 shrink-0 pt-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            <div className="relative flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                    {people.map(p => (
                        <span key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1 text-[11px] font-bold text-blue-900">
                            <span className="truncate">{p.name}</span>
                            <button
                                type="button"
                                aria-label={`Remove ${p.name}`}
                                onClick={() => onChange(people.filter(x => x.id !== p.id))}
                                className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                    <div className="relative min-w-[8rem] flex-1">
                        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            value={term}
                            autoFocus={autoFocus}
                            onChange={e => setTerm(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Backspace' && !term && people.length) onChange(people.slice(0, -1));
                                if (e.key === 'Enter' && options[0]) { e.preventDefault(); onChange([...people, options[0]]); setTerm(''); setResults([]); }
                            }}
                            placeholder={people.length ? 'Add another person…' : 'Search by name or department…'}
                            className="w-full rounded-lg py-1.5 pl-7 pr-2 text-xs outline-none placeholder:text-slate-300 focus:bg-slate-50"
                        />
                    </div>
                </div>
                {(loading || options.length > 0) && term.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {loading && options.length === 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Searching…</div>
                        )}
                        {options.map(u => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => { onChange([...people, u]); setTerm(''); setResults([]); }}
                                className="w-full px-3 py-2 text-left transition-colors hover:bg-blue-50"
                            >
                                <p className="text-xs font-black text-slate-700">{u.name}</p>
                                {u.department && <p className="text-[10px] text-slate-400">{u.department}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Compose window ──────────────────────────────────────────────────────────

function ReplyComposer({ memoId, memoTitle, state, onClose }: { memoId: number; memoTitle: string; state: ComposeState; onClose: () => void }) {
    const router = useRouter();
    const [to, setTo] = useState(state.to);
    const [cc, setCc] = useState(state.cc);
    const [bcc, setBcc] = useState(state.bcc);
    const [showCopies, setShowCopies] = useState(state.cc.length > 0 || state.bcc.length > 0);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const isForward = state.mode === 'forward';
    const canSend = to.length > 0 && (isForward || !isCommentEmpty(message)) && !sending;
    const ids = (list: ReplyPerson[]) => list.map(p => p.id);

    const send = async () => {
        if (!to.length) { toast.error('Add at least one person in the "To" field.'); return; }
        if (!isForward && isCommentEmpty(message)) { toast.error('Write a reply before sending.'); return; }
        setSending(true);
        try {
            const body = (isCommentEmpty(message) ? '' : message) + (isForward && state.parent ? forwardedBlock(state.parent) : '');
            const res = await postMemoReply(memoId, {
                to: ids(to), cc: ids(cc), bcc: ids(bcc),
                message: body,
                parentId: state.parent?.id ?? null,
                mode: isForward ? 'forward' : 'reply',
            });
            if (res.success) {
                const total = to.length + cc.length + bcc.length;
                toast.success(`${isForward ? 'Forwarded' : 'Reply sent'} to ${total} ${total === 1 ? 'person' : 'people'}`);
                onClose();
                router.refresh();
            } else {
                toast.error(res.error || 'Failed to send the reply.');
            }
        } catch {
            toast.error('Failed to send the reply.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={state.title}
                className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1a5aa6]">{state.title}</p>
                        <h3 className="mt-0.5 break-words text-sm font-black text-[#0b2a5b]">
                            {isForward ? 'Fwd' : 'Re'}: {memoTitle}
                        </h3>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3 overflow-y-auto px-5 pb-5 pt-1">
                    <div>
                        <div className="relative">
                            <RecipientField label="To" people={to} onChange={setTo} exclude={[...ids(cc), ...ids(bcc)]} autoFocus={to.length === 0} />
                            {!showCopies && (
                                <button
                                    type="button"
                                    onClick={() => setShowCopies(true)}
                                    className="absolute right-0 top-3 text-[10px] font-black uppercase tracking-widest text-[#1a5aa6] hover:underline"
                                >
                                    Cc / Bcc
                                </button>
                            )}
                        </div>
                        {showCopies && (
                            <>
                                <RecipientField label="Cc" people={cc} onChange={setCc} exclude={[...ids(to), ...ids(bcc)]} />
                                <RecipientField label="Bcc" people={bcc} onChange={setBcc} exclude={[...ids(to), ...ids(cc)]} />
                            </>
                        )}
                    </div>

                    <CommentEditor
                        autoFocus={to.length > 0}
                        value={message}
                        onChange={setMessage}
                        placeholder={isForward ? 'Add a note (optional)…' : 'Write your reply…'}
                    />

                    {isForward && state.parent && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Forwarded message from {state.parent.author_name}
                            </p>
                            <CommentContent value={state.parent.message} className="text-xs text-slate-600" />
                        </div>
                    )}

                    <p className="text-[11px] font-medium text-slate-500">
                        Everyone in To and Cc can see each other. People in Bcc are hidden from the others.
                        Recipients can reply or forward the memo onward. Replying does not approve or reject the memo.
                    </p>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <button type="button" onClick={onClose} className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-300">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={send}
                        disabled={!canSend}
                        className="flex items-center gap-2 rounded-xl bg-[#0b2a5b] px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-[#1a5aa6] disabled:opacity-50"
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {isForward ? 'Forward' : 'Send Reply'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Reply button for the memo itself ────────────────────────────────────────

/**
 * "Reply" button. Opens the compose window addressed to the memo's sender by default;
 * the sender can be removed and anyone else added in To, Cc or Bcc.
 */
export function MemoReplyButton({
    memoId,
    memoTitle,
    defaultTo,
    variant = 'light'
}: {
    memoId: number;
    memoTitle: string;
    defaultTo: ReplyPerson[];
    variant?: 'light' | 'dark';
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'flex items-center gap-2 transition-colors',
                    variant === 'dark'
                        ? 'rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:border-white/30 hover:bg-white/20'
                        : 'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0b2a5b] shadow-sm hover:bg-slate-50'
                )}
            >
                <Reply size={13} />
                Reply
            </button>
            {open && (
                <ReplyComposer
                    memoId={memoId}
                    memoTitle={memoTitle}
                    state={{ mode: 'reply', title: 'Reply to memo', parent: null, to: defaultTo, cc: [], bcc: [] }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

// ─── Reply threads under the memo ────────────────────────────────────────────

type ReplyNode = MemoReplyMessage & { children: ReplyNode[] };

function buildTree(replies: MemoReplyMessage[]): ReplyNode[] {
    const byId = new Map<number, ReplyNode>(replies.map(r => [r.id, { ...r, children: [] }]));
    const roots: ReplyNode[] = [];
    for (const node of byId.values()) {
        // A parent the viewer cannot see (not a recipient of it) makes this a root for them
        const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
        if (parent) parent.children.push(node); else roots.push(node);
    }
    return roots;
}

function RecipientLine({ label, names }: { label: string; names: string[] }) {
    if (names.length === 0) return null;
    return (
        <p className="break-words text-[10px] font-medium text-slate-500">
            <span className="mr-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">{label}:</span>
            {names.join(', ')}
        </p>
    );
}

function ReplyCard({ node, depth, currentUserId, onCompose }: {
    node: ReplyNode;
    depth: number;
    currentUserId: number;
    onCompose: (mode: ComposeMode, m: MemoReplyMessage) => void;
}) {
    const mine = node.author_id === currentUserId;
    const label = (type: ReplyRecipientType) => node.recipients.filter(r => r.type === type).map(r => (r.user_id === currentUserId ? 'You' : r.name));
    // "Reply all" only when it would reach more people than "Reply"
    const hasOthers = mine
        ? node.recipients.some(r => r.type === 'CC')
        : node.recipients.some(r => r.type !== 'BCC' && r.user_id !== currentUserId);

    return (
        <div className={cn(depth > 0 && 'border-l-2 border-slate-100 pl-3 sm:pl-4', depth > 0 && depth <= 3 && 'ml-2 sm:ml-4')}>
            <article className={cn('rounded-2xl border px-4 py-3', node.unread ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white')}>
                <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b2a5b] text-xs font-black text-white">
                            {(node.author_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="flex items-center gap-2 text-xs font-black text-slate-800">
                                {mine ? 'You' : node.author_name}
                                {node.unread && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">New</span>}
                            </p>
                            <RecipientLine label="To" names={label('To')} />
                            <RecipientLine label="Cc" names={label('CC')} />
                            <RecipientLine label="Bcc" names={label('BCC')} />
                        </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{formatDate(node.created_at)}</span>
                </header>

                <CommentContent value={node.message} className="mt-2 text-xs text-slate-700" />

                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onCompose('reply', node)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#0b2a5b] transition-colors hover:bg-slate-50">
                        <Reply size={11} /> Reply
                    </button>
                    {hasOthers && (
                        <button type="button" onClick={() => onCompose('replyAll', node)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#0b2a5b] transition-colors hover:bg-slate-50">
                            <ReplyAll size={11} /> Reply all
                        </button>
                    )}
                    <button type="button" onClick={() => onCompose('forward', node)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#1a5aa6] transition-colors hover:bg-slate-50">
                        <Forward size={11} /> Forward
                    </button>
                </div>
            </article>

            {node.children.length > 0 && (
                <div className="mt-2 space-y-2">
                    {node.children.map(child => (
                        <ReplyCard key={child.id} node={child} depth={depth + 1} currentUserId={currentUserId} onCompose={onCompose} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Email-style reply threads under the memo. Each message shows its From / To / Cc
 * (and Bcc to those allowed to see it) with Reply, Reply all and Forward.
 */
export default function MemoRepliesThread({
    memoId,
    memoTitle,
    replies,
    currentUserId
}: {
    memoId: number;
    memoTitle: string;
    replies: MemoReplyMessage[];
    currentUserId: number;
}) {
    const tree = useMemo(() => buildTree(replies), [replies]);
    const [compose, setCompose] = useState<ComposeState | null>(null);
    const hasUnread = replies.some(r => r.unread);

    useEffect(() => {
        if (hasUnread) markMemoRepliesRead(memoId);
    }, [hasUnread, memoId]);

    if (replies.length === 0) return null;

    const person = (r: { user_id: number; name: string; department: string | null }): ReplyPerson => ({ id: r.user_id, name: r.name, department: r.department });

    const openCompose = (mode: ComposeMode, m: MemoReplyMessage) => {
        const author: ReplyPerson = { id: m.author_id, name: m.author_name };
        const mineMsg = m.author_id === currentUserId;
        const visibleTo = m.recipients.filter(r => r.type === 'To').map(person);
        const visibleCc = m.recipients.filter(r => r.type === 'CC').map(person);
        if (mode === 'forward') {
            setCompose({ mode, title: 'Forward reply', parent: m, to: [], cc: [], bcc: [] });
        } else if (mode === 'replyAll') {
            const to = uniquePeople(mineMsg ? visibleTo : [author, ...visibleTo], [currentUserId]);
            setCompose({ mode, title: 'Reply all', parent: m, to, cc: uniquePeople(visibleCc, [currentUserId, ...to.map(p => p.id)]), bcc: [] });
        } else {
            // Replying to your own message goes to the people you sent it to
            setCompose({ mode, title: `Reply to ${mineMsg ? 'your message' : m.author_name}`, parent: m, to: uniquePeople(mineMsg ? visibleTo : [author], [currentUserId]), cc: [], bcc: [] });
        }
    };

    return (
        <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b2a5b]/5 text-[#0b2a5b]">
                        <MessageSquareReply size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-[#0b2a5b]">Replies</h3>
                        <p className="text-[11px] font-medium text-slate-500">Replies you sent or received on this memo.</p>
                    </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {replies.length} message{replies.length === 1 ? '' : 's'}
                </span>
            </div>

            <div className="space-y-3">
                {tree.map(node => (
                    <ReplyCard key={node.id} node={node} depth={0} currentUserId={currentUserId} onCompose={openCompose} />
                ))}
            </div>

            {compose && <ReplyComposer memoId={memoId} memoTitle={memoTitle} state={compose} onClose={() => setCompose(null)} />}
        </section>
    );
}
