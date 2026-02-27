'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import {
    SendHorizonal,
    Forward,
    MessageSquare,
    Search,
    X,
    CornerDownRight,
    Loader2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import {
    forwardMemoConsultation,
    respondToConsultation,
    searchUsersForConsultation
} from '@/lib/actions';

interface ConsultationNode {
    id: number;
    memo_id: number;
    from_user_id: number;
    to_user_id: number;
    from_name: string;
    to_name: string;
    message: string;
    parent_id: number | null;
    type: 'Forward' | 'Response';
    created_at: string;
}

interface Props {
    memoId: number;
    memoUuid: string;
    currentUserId: number;
    currentUserName: string;
    consultations: ConsultationNode[];
    /** can this user initiate a new top-level forward? (approvers + forwardees) */
    canForward: boolean;
    /** When true, render only the Forward button (for embedding next to Approve/Reject) */
    buttonOnly?: boolean;
}

/** Build a tree from the flat list */
function buildTree(nodes: ConsultationNode[]): (ConsultationNode & { children: any[] })[] {
    const map: Record<number, any> = {};
    nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
    const roots: any[] = [];
    nodes.forEach(n => {
        if (n.parent_id && map[n.parent_id]) {
            map[n.parent_id].children.push(map[n.id]);
        } else {
            roots.push(map[n.id]);
        }
    });
    return roots;
}

/** User-search with debounce */
function useUserSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!query.trim() || query.length < 2) { setResults([]); return; }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            const res = await searchUsersForConsultation(query);
            setResults(res);
            setLoading(false);
        }, 350);
    }, [query]);

    return { query, setQuery, results, loading, setResults };
}

/** The forward / respond modal */
function ConsultationModal({
    actionType,
    memoId,
    parentId,
    defaultTo,
    title,
    placeholder,
    onClose,
    onDone
}: {
    actionType: 'Forward' | 'Response';
    memoId: number;
    parentId: number | null;
    defaultTo?: { id: number; username: string } | null;
    title: string;
    placeholder: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [selectedUser, setSelectedUser] = useState<{ id: number; username: string } | null>(defaultTo || null);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const { query, setQuery, results, loading, setResults } = useUserSearch();

    const submit = () => {
        if (!selectedUser || !message.trim()) return;
        startTransition(async () => {
            if (actionType === 'Response' && parentId !== null) {
                // responding in thread
                await respondToConsultation(memoId, parentId, selectedUser.id, message);
            } else {
                // new forward (top-level or child thread)
                await forwardMemoConsultation(memoId, selectedUser.id, message, parentId);
            }
            onDone();
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-tight">{title}</h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                        <X size={14} className="text-slate-500" />
                    </button>
                </div>

                {/* Recipient selector */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forward To</label>
                    {selectedUser ? (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                            <div>
                                <p className="text-xs font-black text-blue-900">{selectedUser.username}</p>
                            </div>
                            {!defaultTo && (
                                <button onClick={() => setSelectedUser(null)} className="text-blue-400 hover:text-blue-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by name or department…"
                                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                            />
                            {(loading || results.length > 0) && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-10">
                                    {loading && <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Searching…</div>}
                                    {results.map((u: any) => (
                                        <button
                                            key={u.id}
                                            onClick={() => { setSelectedUser(u); setResults([]); setQuery(''); }}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                                        >
                                            <p className="text-xs font-black text-slate-700">{u.username}</p>
                                            <p className="text-[10px] text-slate-400">{u.department}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Message */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message / Query</label>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder={placeholder}
                        rows={4}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none leading-relaxed"
                    />
                </div>

                <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-black text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!selectedUser || !message.trim() || isPending}
                        className="flex-1 py-2 text-xs font-black text-white bg-[#1a365d] rounded-xl hover:bg-[#2d4a7a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                        {isPending ? <Loader2 size={13} className="animate-spin" /> : <SendHorizonal size={13} />}
                        {isPending ? 'Sending…' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Recursive thread node */
function ThreadNode({
    node,
    memoId,
    currentUserId,
    depth = 0,
    onRefresh
}: {
    node: ConsultationNode & { children: any[] };
    memoId: number;
    currentUserId: number;
    depth?: number;
    onRefresh: () => void;
}) {
    const [showReply, setShowReply] = useState(false);
    const [showForward, setShowForward] = useState(false);
    const [expanded, setExpanded] = useState(true);

    const isSender = node.from_user_id === currentUserId;
    const isReceiver = node.to_user_id === currentUserId;
    const canAct = isReceiver; // only the recipient can reply/forward

    const isForward = node.type === 'Forward';

    return (
        <div className={cn("relative", depth > 0 && "ml-6 border-l-2 border-slate-100 pl-4")}>
            <div className={cn(
                "rounded-xl p-3 space-y-1.5 border",
                isForward
                    ? "bg-blue-50/60 border-blue-100"
                    : "bg-emerald-50/60 border-emerald-100"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                            isForward ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
                        )}>
                            {isForward ? 'Forward' : 'Response'}
                        </span>
                        <span className="text-[10px] font-black text-slate-600">
                            {node.from_name}
                        </span>
                        <CornerDownRight size={10} className="text-slate-300" />
                        <span className="text-[10px] font-black text-slate-600">{node.to_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400">{formatDate(node.created_at)}</span>
                        {node.children.length > 0 && (
                            <button onClick={() => setExpanded(v => !v)} className="text-slate-300 hover:text-slate-500">
                                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Message */}
                <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{node.message}</p>

                {/* Actions — only the direct recipient can act */}
                {canAct && (
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => { setShowReply(true); setShowForward(false); }}
                            className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors uppercase tracking-widest"
                        >
                            <MessageSquare size={10} /> Reply
                        </button>
                        <button
                            onClick={() => { setShowForward(true); setShowReply(false); }}
                            className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors uppercase tracking-widest"
                        >
                            <Forward size={10} /> Forward
                        </button>
                    </div>
                )}
            </div>

            {/* Reply Modal — responds back to the person who sent this node */}
            {showReply && (
                <ConsultationModal
                    actionType="Response"
                    memoId={memoId}
                    parentId={node.id}
                    defaultTo={{ id: node.from_user_id, username: node.from_name }}
                    title={`Reply to ${node.from_name}`}
                    placeholder={`Your response to ${node.from_name}…`}
                    onClose={() => setShowReply(false)}
                    onDone={() => { setShowReply(false); onRefresh(); }}
                />
            )}

            {/* Forward Modal — forward to anyone */}
            {showForward && (
                <ConsultationModal
                    actionType="Forward"
                    memoId={memoId}
                    parentId={node.id}
                    title="Forward for Further Input"
                    placeholder="Explain what input you need from this person…"
                    onClose={() => setShowForward(false)}
                    onDone={() => { setShowForward(false); onRefresh(); }}
                />
            )}

            {/* Children */}
            {expanded && node.children.length > 0 && (
                <div className="mt-2 space-y-2">
                    {node.children.map((child: any) => (
                        <ThreadNode
                            key={child.id}
                            node={child}
                            memoId={memoId}
                            currentUserId={currentUserId}
                            depth={depth + 1}
                            onRefresh={onRefresh}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ConsultationThread({
    memoId,
    memoUuid,
    currentUserId,
    currentUserName,
    consultations,
    canForward,
    buttonOnly = false
}: Props) {
    const [threads, setThreads] = useState(buildTree(consultations));
    const [showNewForward, setShowNewForward] = useState(false);

    const refresh = () => { window.location.reload(); };

    // ── Button-only mode: just the Forward for Input trigger ──────────────────
    if (buttonOnly) {
        if (!canForward) return null;
        return (
            <>
                <button
                    onClick={() => setShowNewForward(true)}
                    className="flex items-center gap-2 text-xs font-black text-white bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 px-4 py-2.5 rounded-xl transition-colors uppercase tracking-wide shadow-sm"
                >
                    <Forward size={14} className="text-white" />
                    Forward
                </button>
                {showNewForward && (
                    <ConsultationModal
                        actionType="Forward"
                        memoId={memoId}
                        parentId={null}
                        title="Forward Memo for Consultation"
                        placeholder="Describe what input or information you need from this person…"
                        onClose={() => setShowNewForward(false)}
                        onDone={() => { setShowNewForward(false); refresh(); }}
                    />
                )}
            </>
        );
    }

    // ── Full thread view ──────────────────────────────────────────────────────
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                    <h3 className="text-lg font-black text-[#1a365d] font-outfit uppercase tracking-tight">
                        Consultation Thread
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Private input requests attached to this memo
                    </p>
                </div>
                {canForward && (
                    <button
                        onClick={() => setShowNewForward(true)}
                        className="flex items-center gap-2 text-xs font-black text-white bg-[#1a365d] hover:bg-[#2d4a7a] px-3 py-2 rounded-xl transition-colors uppercase tracking-wide"
                    >
                        <Forward size={13} />
                        Forward
                    </button>
                )}
            </div>

            {/* Thread list */}
            {threads.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                    <MessageSquare size={28} className="text-slate-200 mx-auto" />
                    <p className="text-xs font-medium text-slate-400">No consultations yet.</p>
                    {canForward && (
                        <p className="text-[10px] text-slate-300">Use "Forward for Input" to seek input from a colleague.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {threads.map(node => (
                        <ThreadNode
                            key={node.id}
                            node={node}
                            memoId={memoId}
                            currentUserId={currentUserId}
                            depth={0}
                            onRefresh={refresh}
                        />
                    ))}
                </div>
            )}

            {/* New top-level forward modal */}
            {showNewForward && (
                <ConsultationModal
                    actionType="Forward"
                    memoId={memoId}
                    parentId={null}
                    title="Forward Memo for Consultation"
                    placeholder="Describe what input or information you need from this person…"
                    onClose={() => setShowNewForward(false)}
                    onDone={() => { setShowNewForward(false); refresh(); }}
                />
            )}
        </div>
    );
}
