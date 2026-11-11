'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reply, MessageSquareReply, Send, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { postMemoReply } from '@/lib/actions';
import { isCommentEmpty } from '@/lib/rich-text';
import { cn, formatDate } from '@/lib/utils';
import CommentEditor from '@/components/memos/CommentEditor';
import CommentContent from '@/components/memos/CommentContent';

export interface MemoReplyRow {
    id: number;
    thread_user_id: number;
    author_id: number;
    author_name: string;
    thread_user_name: string;
    message: string;
    created_at: string;
}

/**
 * "Reply" button for the decision panels. A reviewer (line manager, approver,
 * final approver or an unacknowledged recipient) writes to the memo's creator
 * before deciding. The memo stays pending; nothing is approved or rejected.
 */
export function MemoReplyButton({ memoId, creatorName }: { memoId: number; creatorName: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (isCommentEmpty(message)) {
            toast.error('Write a reply before sending.');
            return;
        }
        setSending(true);
        try {
            const res = await postMemoReply(memoId, message);
            if (res.success) {
                toast.success(`Reply sent to ${creatorName}`);
                setMessage('');
                setOpen(false);
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
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 text-xs font-black text-white bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 px-4 py-2.5 rounded-xl transition-colors uppercase tracking-wide shadow-sm"
            >
                <Reply size={14} className="text-white" />
                Reply
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#1a5aa6]">Reply to memo</p>
                                <h3 className="text-sm font-black text-[#0b2a5b] mt-0.5 break-words">To: {creatorName}</h3>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3 overflow-y-auto">
                            <CommentEditor
                                autoFocus
                                value={message}
                                onChange={setMessage}
                                placeholder="Write your reply, question or comment to the sender..."
                            />
                            <p className="text-[11px] text-slate-500 font-medium">
                                Your reply goes privately to the sender. The memo stays waiting for your decision; you can approve or reject it afterwards.
                            </p>
                        </div>
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={send}
                                disabled={sending || isCommentEmpty(message)}
                                className="px-5 py-2 bg-[#0b2a5b] hover:bg-[#1a5aa6] text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                Send Reply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Reply conversations shown under the memo. The creator sees one conversation per
 * reviewer and can answer each; a reviewer sees only their own conversation.
 */
export default function MemoRepliesThread({
    memoId,
    replies,
    currentUserId,
    isCreator,
    creatorName
}: {
    memoId: number;
    replies: MemoReplyRow[];
    currentUserId: number;
    isCreator: boolean;
    creatorName: string;
}) {
    const threads = useMemo(() => {
        const map = new Map<number, { userId: number; userName: string; messages: MemoReplyRow[] }>();
        for (const r of replies) {
            if (!map.has(r.thread_user_id)) {
                map.set(r.thread_user_id, { userId: r.thread_user_id, userName: r.thread_user_name, messages: [] });
            }
            map.get(r.thread_user_id)!.messages.push(r);
        }
        return Array.from(map.values());
    }, [replies]);

    if (threads.length === 0) return null;

    return (
        <section className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0b2a5b]/5 text-[#0b2a5b] flex items-center justify-center">
                        <MessageSquareReply size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#0b2a5b] uppercase tracking-wider">Replies</h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {isCreator ? 'Private conversations with the people reviewing your memo.' : `Your private conversation with ${creatorName}.`}
                        </p>
                    </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {replies.length} message{replies.length === 1 ? '' : 's'}
                </span>
            </div>

            {threads.map(thread => (
                <ReplyConversation
                    key={thread.userId}
                    memoId={memoId}
                    thread={thread}
                    currentUserId={currentUserId}
                    isCreator={isCreator}
                    showHeading={isCreator && threads.length > 0}
                />
            ))}
        </section>
    );
}

function ReplyConversation({
    memoId,
    thread,
    currentUserId,
    isCreator,
    showHeading
}: {
    memoId: number;
    thread: { userId: number; userName: string; messages: MemoReplyRow[] };
    currentUserId: number;
    isCreator: boolean;
    showHeading: boolean;
}) {
    const router = useRouter();
    const [composing, setComposing] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (isCommentEmpty(message)) return;
        setSending(true);
        try {
            const res = await postMemoReply(memoId, message, isCreator ? thread.userId : undefined);
            if (res.success) {
                toast.success('Reply sent');
                setMessage('');
                setComposing(false);
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
        <div className="space-y-3">
            {showHeading && (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Conversation with <span className="text-slate-700">{thread.userName}</span>
                </p>
            )}

            <div className="space-y-3">
                {thread.messages.map(m => {
                    const mine = m.author_id === currentUserId;
                    return (
                        <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                                'max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 border',
                                mine ? 'bg-[#0b2a5b]/[0.04] border-[#0b2a5b]/10' : 'bg-slate-50 border-slate-200'
                            )}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 mb-1.5">
                                    <span className="text-[11px] font-black text-[#0b2a5b]">{mine ? 'You' : m.author_name}</span>
                                    <span className="text-[10px] font-medium text-slate-400">{formatDate(m.created_at)}</span>
                                </div>
                                <CommentContent value={m.message} className="text-xs text-slate-700" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {composing ? (
                <div className="space-y-3">
                    <CommentEditor
                        autoFocus
                        value={message}
                        onChange={setMessage}
                        placeholder={isCreator ? `Answer ${thread.userName}...` : 'Write a follow-up...'}
                    />
                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => { setComposing(false); setMessage(''); }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={send}
                            disabled={sending || isCommentEmpty(message)}
                            className="px-5 py-2 bg-[#0b2a5b] hover:bg-[#1a5aa6] text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            Send
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setComposing(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0b2a5b] font-bold text-xs rounded-xl transition-colors"
                    >
                        <Reply size={13} />
                        {isCreator ? `Answer ${thread.userName.split(' ')[0]}` : 'Reply again'}
                    </button>
                </div>
            )}
        </div>
    );
}
