'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Save,
    Send,
    ChevronRight,
    Paperclip,
    X,
    Plus,
    AlertCircle,
    Users as UsersIcon,
    Check
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { cn } from '@/lib/utils';
import { MemoPriority, MemoType } from '@/types/memo';

const memoSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters'),
    department: z.string().min(1, 'Department is required'),
    category: z.string().min(1, 'Category is required'),
    priority: z.enum(['Low', 'Medium', 'High']),
    memo_type: z.enum(['Informational', 'Approval', 'Action']),
    expiry_date: z.string().optional(),
    content: z.string().min(20, 'Content is too short'),
    recipient_ids: z.array(z.number()).min(1, 'Please select at least one recipient'),
});

type MemoFormValues = z.infer<typeof memoSchema>;

interface MemoFormProps {
    initialData?: Partial<MemoFormValues>;
    onSubmit: (data: MemoFormValues & { attachments: File[] }, isDraft: boolean) => void;
    isLoading?: boolean;
    recipients?: any[];
}

export default function MemoForm({ initialData, onSubmit, isLoading, recipients = [] }: MemoFormProps) {
    const [attachments, setAttachments] = useState<File[]>([]);
    const [searchRecipient, setSearchRecipient] = useState('');

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        formState: { errors }
    } = useForm<MemoFormValues>({
        resolver: zodResolver(memoSchema),
        defaultValues: {
            title: initialData?.title || '',
            department: initialData?.department || '',
            category: initialData?.category || '',
            priority: initialData?.priority || 'Medium',
            memo_type: initialData?.memo_type || 'Informational',
            expiry_date: initialData?.expiry_date || '',
            content: initialData?.content || '',
            recipient_ids: initialData?.recipient_ids || [],
        },
    });

    const selectedRecipientIds = watch('recipient_ids');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const toggleRecipient = (id: number) => {
        const current = selectedRecipientIds || [];
        if (current.includes(id)) {
            setValue('recipient_ids', current.filter(rid => rid !== id));
        } else {
            setValue('recipient_ids', [...current, id]);
        }
    };

    const filteredRecipients = recipients.filter(r =>
        r.username.toLowerCase().includes(searchRecipient.toLowerCase()) ||
        r.department.toLowerCase().includes(searchRecipient.toLowerCase())
    );

    return (
        <form className="space-y-8 max-w-6xl mx-auto pb-20 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-[#1a365d] font-outfit">Drafting Memo</h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">Institutional Communication Workflow</p>
                </div>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={handleSubmit(data => onSubmit({ ...data, attachments }, true))}
                        disabled={isLoading}
                        className="flex items-center gap-3 px-5 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        <Save size={16} />
                        Save Draft
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit(data => onSubmit({ ...data, attachments }, false))}
                        disabled={isLoading}
                        className="flex items-center gap-3 px-6 py-3 bg-[#1a365d] text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50 outline-none"
                    >
                        <Send size={16} />
                        Route for Approval
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Memo Subject / Title</label>
                            <input
                                {...register('title')}
                                className={cn(
                                    "w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3.5 text-lg font-bold text-[#1a365d] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none",
                                    errors.title && "border-red-300 ring-4 ring-red-500/10"
                                )}
                                placeholder="Formal subject heading..."
                            />
                            {errors.title && <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 ml-1"><AlertCircle size={14} /> {errors.title.message}</p>}
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Official Content</label>
                            <Controller
                                name="content"
                                control={control}
                                render={({ field }) => (
                                    <RichTextEditor
                                        content={field.value}
                                        onChange={field.onChange}
                                        className={cn(
                                            "rounded-3xl",
                                            errors.content && "border-red-300"
                                        )}
                                    />
                                )}
                            />
                            {errors.content && <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 ml-1"><AlertCircle size={14} /> {errors.content.message}</p>}
                        </div>
                    </div>

                    {/* Recipient Selection Section */}
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm space-y-8">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <UsersIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[#1a365d] font-outfit uppercase tracking-wider">Distribution List</h3>
                                    <p className="text-xs text-slate-400 font-medium">Select authorized recipients for this memo.</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Selected</span>
                                <span className="text-lg font-black text-blue-600">{selectedRecipientIds.length} Persons</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Filter by name or department..."
                                    value={searchRecipient}
                                    onChange={(e) => setSearchRecipient(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-6 text-sm font-medium outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
                                {filteredRecipients.map(user => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => toggleRecipient(user.id)}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                                            selectedRecipientIds.includes(user.id)
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20"
                                                : "bg-white border-slate-200 hover:border-blue-300"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                                            selectedRecipientIds.includes(user.id) ? "bg-white/20" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {selectedRecipientIds.includes(user.id) ? <Check size={20} /> : user.username[0]}
                                        </div>
                                        <div className="flex-grow overflow-hidden">
                                            <p className={cn(
                                                "font-bold text-sm truncate",
                                                selectedRecipientIds.includes(user.id) ? "text-white" : "text-slate-900"
                                            )}>{user.username}</p>
                                            <p className={cn(
                                                "text-[10px] font-black uppercase tracking-widest truncate mt-1 opacity-60",
                                                selectedRecipientIds.includes(user.id) ? "text-blue-100" : "text-slate-400"
                                            )}>{user.department || 'General'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {errors.recipient_ids && <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 ml-1"><AlertCircle size={14} /> {errors.recipient_ids.message}</p>}
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2.2rem] p-10 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} />
                                Supplemental Documentation
                            </h3>
                            <label className="cursor-pointer px-5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#1a365d] hover:bg-slate-100 transition-all">
                                Upload Files
                                <input type="file" multiple className="hidden" onChange={handleFileChange} />
                            </label>
                        </div>

                        {attachments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-slate-50/50 group">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-500">
                                                <Paperclip size={18} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                                                <p className="text-[10px] text-slate-400 font-black">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-slate-100 rounded-[2rem] p-12 text-center bg-slate-50/30">
                                <Paperclip size={32} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No attachments anchored</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-[#1a365d] border border-blue-900 rounded-[2.2rem] p-10 shadow-2xl space-y-8 text-white">
                        <h2 className="text-xl font-black font-outfit uppercase tracking-tight border-b border-white/10 pb-6">Memo Metadata</h2>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Allocated Department</label>
                                <select
                                    {...register('department')}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none appearance-none"
                                >
                                    <option value="" className="text-slate-900">Select...</option>
                                    <option value="Directorate of ICT" className="text-slate-900">Directorate of ICT</option>
                                    <option value="Office of the Registrar" className="text-slate-900">Office of the Registrar</option>
                                    <option value="Human Resources" className="text-slate-900">Human Resources</option>
                                    <option value="Student Affairs" className="text-slate-900">Student Affairs</option>
                                    <option value="Bursary (Finance)" className="text-slate-900">Bursary (Finance)</option>
                                    <option value="Faculty of Computing" className="text-slate-900">Faculty of Computing</option>
                                    <option value="Faculty of Arts & Social Sciences" className="text-slate-900">Faculty of Arts & Social Sciences</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Classification</label>
                                <input
                                    {...register('category')}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none"
                                    placeholder="e.g. Strategic Policy"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Priority</label>
                                    <select
                                        {...register('priority')}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none appearance-none"
                                    >
                                        <option value="Low" className="text-slate-900">Low</option>
                                        <option value="Medium" className="text-slate-900">Medium</option>
                                        <option value="High" className="text-slate-900">High</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Type</label>
                                    <select
                                        {...register('memo_type')}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none appearance-none"
                                    >
                                        <option value="Informational" className="text-slate-900">Info</option>
                                        <option value="Approval" className="text-slate-900">Approval</option>
                                        <option value="Action" className="text-slate-900">Action</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Archival Limit (Optional)</label>
                                <input
                                    type="date"
                                    {...register('expiry_date')}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/5 space-y-4">
                            <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Institutional Integrity</h4>
                            <p className="text-[10px] leading-relaxed text-blue-100/40 font-medium">
                                This communication is bound by the CUA Electronic Communications Policy. All distributions are logged.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                        <h4 className="flex items-center gap-2 text-[10px] font-black text-[#1a365d] uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">
                            <AlertCircle size={16} className="text-amber-500" />
                            Drafting Guidelines
                        </h4>
                        <ul className="text-xs space-y-4 text-slate-500">
                            <li className="flex gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                <span>Clearly define target recipients for official tracking.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                <span>Ensure all attachments are relevant to the academic body.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                <span>Final approval follows the 2-step hierarchy.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </form>
    );
}
