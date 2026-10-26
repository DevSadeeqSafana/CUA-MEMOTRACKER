'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Upload, X, Loader2, FileText, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { appendGeneralAttachments, formatBytes, MAX_ATTACHMENT_BYTES } from '@/lib/client-upload';
import { addAttachmentToMemo } from '@/lib/actions';
import { createPortal } from 'react-dom';

interface AddAttachmentButtonProps {
    memoId: number;
    memoUuid: string;
    memoTitle: string;
    memoStatus: string;
    variant?: 'primary' | 'navbar' | 'compact' | 'empty';
    buttonText?: string;
}

export default function AddAttachmentButton({
    memoId,
    memoUuid,
    memoTitle,
    memoStatus,
    variant = 'primary',
    buttonText
}: AddAttachmentButtonProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [reason, setReason] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        addFiles(newFiles);
    };

    const addFiles = (incoming: File[]) => {
        const valid: File[] = [];
        for (const file of incoming) {
            if (file.size > MAX_ATTACHMENT_BYTES) {
                toast.error(`"${file.name}" exceeds the ${formatBytes(MAX_ATTACHMENT_BYTES)} limit.`);
                continue;
            }
            // avoid duplicates
            if (!files.some(f => f.name === file.name && f.size === file.size)) {
                valid.push(file);
            }
        }
        if (valid.length > 0) {
            setFiles(prev => [...prev, ...valid]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            toast.error('Please select at least one file to attach.');
            return;
        }

        setIsUploading(true);
        let toastId: string | undefined;

        try {
            const formData = new FormData();
            formData.append('reason', reason.trim());

            if (files.length > 0) {
                toastId = toast.loading(`Uploading attachment (0/${files.length})…`);
            }

            await appendGeneralAttachments(formData, files, (done, total) => {
                if (toastId) toast.loading(`Uploading attachment (${done}/${total})…`, { id: toastId });
            });

            if (toastId) toast.dismiss(toastId);

            const result = await addAttachmentToMemo(memoId, formData);
            if (result.success) {
                toast.success(`${result.count || files.length} document(s) attached and audited successfully!`);
                setFiles([]);
                setReason('');
                setIsOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to attach files.');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Upload failed. Please try again.', toastId ? { id: toastId } : undefined);
        } finally {
            setIsUploading(false);
        }
    };

    const renderTrigger = () => {
        if (variant === 'navbar') {
            return (
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-slate-900/10 cursor-pointer"
                    title="Attach file to memo"
                >
                    <Paperclip size={13} className="text-blue-400" />
                    <span>{buttonText || 'Attach File'}</span>
                </button>
            );
        }

        if (variant === 'empty') {
            return (
                <button
                    onClick={() => setIsOpen(true)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                    <Paperclip size={14} className="text-blue-600" />
                    <span>{buttonText || 'Attach Supporting Document'}</span>
                </button>
            );
        }

        if (variant === 'compact') {
            return (
                <button
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border border-blue-200 cursor-pointer"
                >
                    <Paperclip size={12} className="text-blue-600" />
                    <span>{buttonText || 'Attach'}</span>
                </button>
            );
        }

        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
                <Paperclip size={13} className="text-blue-600" />
                <span>{buttonText || '+ Attach File'}</span>
            </button>
        );
    };

    return (
        <>
            {renderTrigger()}

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-[#0b2a5b]/60 backdrop-blur-sm"
                        onClick={() => !isUploading && setIsOpen(false)}
                    />

                    {/* Modal Dialog */}
                    <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 z-10">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                                    <Paperclip size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-tight">Attach File to Memo</h3>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Post-submission document attachment
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !isUploading && setIsOpen(false)}
                                disabled={isUploading}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-40"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                            {/* Institutional Record Notice */}
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                                <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-amber-900/80 leading-relaxed">
                                    <span className="font-bold text-amber-900">Audited Record:</span> Any file attached to this memo (currently in <span className="font-bold text-slate-800">{memoStatus}</span>) is permanently recorded in the institutional audit trail with your timestamp and identity for record-keeping purposes.
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                                    isDragging
                                        ? "border-blue-500 bg-blue-50/80 scale-[0.99]"
                                        : "border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30"
                                )}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-blue-600 mb-2">
                                    <Upload size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-800">
                                    Click to select or drag and drop files here
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                    PDF, Images, Word, Excel, PowerPoint (Up to {formatBytes(MAX_ATTACHMENT_BYTES)} per file)
                                </p>
                            </div>

                            {/* Selected Files List */}
                            {files.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Selected Files ({files.length})
                                    </p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {files.map((file, idx) => (
                                            <div
                                                key={`${file.name}-${idx}`}
                                                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                        <FileText size={15} />
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {formatBytes(file.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                                    className="w-6 h-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                                                    title="Remove"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Purpose / Reason Note */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Purpose / Document Description <span className="text-slate-400 font-normal">(Recommended for audit record)</span>
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g., Payment voucher, receipt, signed delivery note, execution certificate..."
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-800"
                                />
                                <p className="text-[10px] text-slate-400">
                                    This description will appear beside the document in the audit trail and memo record.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                disabled={isUploading}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={isUploading || files.length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Attaching & Auditing…</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Upload &amp; Attach ({files.length})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
