'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock, MessageSquare, Paperclip, Plus, Save, Undo2, User, X, Loader2 } from 'lucide-react';
import RichTextEditor from '@/components/memos/RichTextEditor';
import { reviseMemoContent } from '@/lib/actions';
import { appendGeneralAttachments, formatBytes } from '@/lib/client-upload';
import { cn } from '@/lib/utils';

interface ExistingAttachment {
    id: number;
    file_name: string;
    file_path: string;
    file_size: number;
}

interface InputRequest {
    id: number;
    from_name: string;
    message: string;
    type: 'Forward' | 'Response';
    created_at: string;
}

interface ReviseMemoClientProps {
    memoId: number;
    memoUuid: string;
    initialTitle: string;
    initialContent: string;
    attachments: ExistingAttachment[];
    inputRequests: InputRequest[];
}

export default function ReviseMemoClient({
    memoId,
    memoUuid,
    initialTitle,
    initialContent,
    attachments,
    inputRequests,
}: ReviseMemoClientProps) {
    const router = useRouter();
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState(initialContent);
    const [removedIds, setRemovedIds] = useState<number[]>([]);
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const toggleRemoved = (id: number) =>
        setRemovedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Title is required.');
            return;
        }
        setIsSaving(true);
        let toastId: string | undefined;
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('content', content);
            formData.append('removed_attachment_ids', JSON.stringify(removedIds));

            if (newFiles.length > 0) toastId = toast.loading(`Uploading attachments (0/${newFiles.length})…`);
            await appendGeneralAttachments(formData, newFiles, (done, total) =>
                toast.loading(`Uploading attachments (${done}/${total})…`, { id: toastId }));
            if (toastId) toast.dismiss(toastId);

            const result = await reviseMemoContent(memoId, formData);
            if (result.success) {
                toast.success('Memo updated.');
                router.push(`/dashboard/memos/${memoUuid}`);
            } else {
                toast.error(result.error || 'Update failed.');
            }
        } catch (err: any) {
            toast.error(err?.message || 'An unexpected error occurred.', toastId ? { id: toastId } : undefined);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <Link
                href={`/dashboard/memos/${memoUuid}`}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#1a365d] transition-all group px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
                <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
                Back to Memo
            </Link>

            {/* Input requests */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-blue-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <MessageSquare size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Input Requested</p>
                        <p className="text-[11px] text-blue-500 font-medium mt-0.5">
                            Update the memo content or attachments to address the comments below.
                        </p>
                    </div>
                </div>
                <div className="divide-y divide-blue-100">
                    {inputRequests.map(r => (
                        <div key={r.id} className="px-6 py-4 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                    <User size={11} />
                                    {r.from_name}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold">
                                    <Clock size={10} />
                                    {new Date(r.created_at).toLocaleDateString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                    })}
                                </div>
                            </div>
                            <p className="text-sm text-blue-900 font-medium leading-relaxed bg-blue-100/50 rounded-xl px-4 py-3 border border-blue-100 whitespace-pre-wrap">
                                &quot;{r.message}&quot;
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-1">
                <h1 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">Edit Memo</h1>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                    The memo keeps its current place in the approval flow; those who requested input will be notified of the update.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Title */}
                <div className="px-6 py-4 border-b border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Subject</label>
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-blue-400 outline-none transition-all"
                    />
                </div>

                {/* Body */}
                <div className="px-6 pt-4 pb-3">
                    <RichTextEditor content={content} onChange={setContent} className="rounded-xl border-0" />
                </div>

                {/* Attachments */}
                <div className="px-6 py-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attachments</p>
                        <label className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl cursor-pointer uppercase tracking-widest transition-colors">
                            <Plus size={12} /> Add Files
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={e => {
                                    const files = e.target.files;
                                    if (files) setNewFiles(prev => [...prev, ...Array.from(files)]);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    </div>

                    {attachments.length === 0 && newFiles.length === 0 && (
                        <p className="text-[11px] text-slate-400 font-medium italic">No attachments.</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {attachments.map(file => {
                            const removed = removedIds.includes(file.id);
                            return (
                                <div
                                    key={file.id}
                                    className={cn(
                                        "flex items-center gap-2 border rounded-xl px-3 py-2",
                                        removed ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                                    )}
                                >
                                    <Paperclip size={12} className={removed ? "text-red-300" : "text-slate-400"} />
                                    <a
                                        href={file.file_path}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={cn(
                                            "text-[11px] font-bold max-w-[200px] truncate hover:underline",
                                            removed ? "text-red-400 line-through" : "text-slate-600"
                                        )}
                                    >
                                        {file.file_name}
                                    </a>
                                    {file.file_size > 0 && <span className="text-[9px] text-slate-400 font-bold">{formatBytes(file.file_size)}</span>}
                                    <button
                                        type="button"
                                        onClick={() => toggleRemoved(file.id)}
                                        title={removed ? 'Keep this attachment' : 'Remove this attachment'}
                                        className={removed ? "text-red-500 hover:text-red-700" : "text-slate-300 hover:text-red-500"}
                                    >
                                        {removed ? <Undo2 size={12} /> : <X size={12} />}
                                    </button>
                                </div>
                            );
                        })}
                        {newFiles.map((file, idx) => (
                            <div key={`new-${idx}`} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                <Paperclip size={12} className="text-emerald-500" />
                                <span className="text-[11px] font-bold text-emerald-700 max-w-[200px] truncate">{file.name}</span>
                                <span className="text-[9px] text-emerald-500 font-bold">{formatBytes(file.size)} · new</span>
                                <button
                                    type="button"
                                    onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-emerald-400 hover:text-red-500"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <Link
                        href={`/dashboard/memos/${memoUuid}`}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Cancel
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1a365d] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
