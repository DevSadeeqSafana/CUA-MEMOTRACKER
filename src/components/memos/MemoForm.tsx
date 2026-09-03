'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
    Check,
    Wallet,
    Loader2,
    FileText as FileTextIcon,
    Trash2,
    ChevronDown,
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { cn } from '@/lib/utils';
import { MemoPriority, MemoType } from '@/types/memo';
import { getBudgetItemsByListId, getBudgetYears, getBudgetItemLists, getDepartments, getCurrentFiscalYear } from '@/lib/actions';
import toast from 'react-hot-toast';

const memoSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters'),
    department: z.string().min(1, 'Department is required'),
    category: z.string().min(1, 'Category is required'),
    priority: z.enum(['Low', 'Medium', 'High']),
    memo_type: z.enum(['Informational', 'Approval', 'Action']),
    expiry_date: z.string().optional(),
    content: z.string().min(20, 'Content is too short'),
    recipient_ids: z.array(z.number()).min(1, 'Please select at least one primary recipient'),
    cc_ids: z.array(z.number()).default([]),
    bcc_ids: z.array(z.number()).default([]),
    is_budget_memo: z.boolean().default(false),
    year_id: z.string().optional(),
    budget_category: z.string().optional(),
    other_category: z.string().optional(),
    custom_category: z.string().optional(),
    budget_items: z.array(z.object({
        name: z.string(),
        budget_item_group: z.string().optional(),
        specific_item: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().min(1),
        amount: z.number().min(0),
        total: z.number().optional(),
        file: z.any().optional(),
    })).optional(),
}).superRefine((data, ctx) => {
    if (data.is_budget_memo) {
        if (!data.year_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Budget Year is required", path: ["year_id"] });
        }
        if (!data.budget_category) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Budget Category is required", path: ["budget_category"] });
        }
        if (!data.budget_items || data.budget_items.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one budget item is required", path: ["budget_items"] });
        } else {
            data.budget_items.forEach((item, idx) => {
                if (!item.name || item.name.trim().length === 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Item #${idx + 1} name is required`, path: ["budget_items", idx, "name"] });
                }
            });
        }
    }
    if (data.category === 'Others' && (!data.custom_category || data.custom_category.trim().length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please specify the classification", path: ["custom_category"] });
    }
});

type MemoFormValues = z.infer<typeof memoSchema>;

interface MemoFormProps {
    initialData?: Partial<MemoFormValues>;
    onSubmit: (data: MemoFormValues & { attachments: File[] }, isDraft: boolean) => void;
    isLoading?: boolean;
    recipients?: any[];
}



// Inline recipient search row (like Gmail's To/CC/BCC fields)
function RecipientRow({
    label,
    fieldKey,
    recipients,
    selectedIds,
    onToggle,
    color = 'blue',
}: {
    label: string;
    fieldKey: 'recipient_ids' | 'cc_ids' | 'bcc_ids';
    recipients: any[];
    selectedIds: number[];
    onToggle: (id: number, field: 'recipient_ids' | 'cc_ids' | 'bcc_ids') => void;
    color?: 'blue' | 'slate' | 'purple';
}) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const colorMap = {
        blue: { chip: 'bg-blue-50 border-blue-100 text-blue-700', dot: 'bg-blue-600', label: 'text-blue-700 border-blue-100', ring: 'focus:border-blue-400' },
        slate: { chip: 'bg-slate-100 border-slate-200 text-slate-600', dot: 'bg-slate-400', label: 'text-slate-500 border-slate-100', ring: 'focus:border-slate-400' },
        purple: { chip: 'bg-purple-50 border-purple-100 text-purple-700', dot: 'bg-purple-400', label: 'text-purple-600 border-purple-100', ring: 'focus:border-purple-400' },
    }[color];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = recipients.filter(r =>
        !selectedIds.includes(r.id) &&
        (r.username.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div ref={wrapperRef} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 group">
            {/* Label */}
            <span className={cn(
                'text-[10px] font-black uppercase tracking-widest mt-2.5 shrink-0 w-8 text-right',
                colorMap.label
            )}>{label}</span>

            {/* Chips + Input */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 relative">
                {selectedIds.map(id => {
                    const user = recipients.find(r => r.id === id);
                    return user ? (
                        <span key={id} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold', colorMap.chip)}>
                            {user.username}
                            <button type="button" onClick={() => onToggle(id, fieldKey)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                                <X size={10} />
                            </button>
                        </span>
                    ) : null;
                })}
                <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={selectedIds.length === 0 ? `Add ${label} recipients...` : ''}
                    className={cn(
                        'flex-1 min-w-[140px] bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 py-1',
                    )}
                />

                {/* Dropdown */}
                {open && search.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-[220px] overflow-y-auto py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {filtered.length === 0 ? (
                            <p className="px-4 py-3 text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">No matches</p>
                        ) : (
                            filtered.map(user => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => { onToggle(user.id, fieldKey); setSearch(''); setOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors group/opt"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px] group-hover/opt:bg-blue-100 group-hover/opt:text-blue-600 transition-colors shrink-0">
                                        {user.username[0]}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-slate-700 truncate">{user.username}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{user.department}</p>
                                    </div>
                                    <Plus size={13} className="ml-auto text-slate-300 group-hover/opt:text-blue-500 shrink-0" />
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MemoForm({ initialData, onSubmit, isLoading, recipients = [] }: MemoFormProps) {
    const [attachments, setAttachments] = useState<File[]>([]);
    const [showBCC, setShowBCC] = useState(false);
    const [showMeta, setShowMeta] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

    const [budgetYears, setBudgetYears] = useState<any[]>([]);
    const [budgetCategories, setBudgetCategories] = useState<{ id: string | number, name: string }[]>([]);
    // map: categoryId -> items loaded from DB
    const [categoryItems, setCategoryItems] = useState<Record<string, { id: string | number, name: string, description: string, amount: number }[]>>({});
    const [departments, setDepartments] = useState<{ name: string }[]>([]);
    const [currentYear, setCurrentYear] = useState<{ id: string, name: string } | null>(null);
    const [loadingItems, setLoadingItems] = useState(false);

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        formState: { errors }
    } = useForm<MemoFormValues>({
        resolver: zodResolver(memoSchema) as any,
        defaultValues: {
            title: initialData?.title || '',
            department: initialData?.department || '',
            category: initialData?.category || '',
            priority: initialData?.priority || 'Medium',
            memo_type: initialData?.memo_type || 'Informational',
            expiry_date: initialData?.expiry_date || '',
            content: initialData?.content || '',
            recipient_ids: initialData?.recipient_ids || [],
            cc_ids: (initialData as any)?.cc_ids || [],
            bcc_ids: (initialData as any)?.bcc_ids || [],
            is_budget_memo: initialData?.is_budget_memo || false,
            year_id: initialData?.year_id || '',
            budget_category: initialData?.budget_category || '',
            other_category: initialData?.other_category || '',
            custom_category: (initialData as any)?.custom_category || '',
            budget_items: initialData?.budget_items && initialData.budget_items.length > 0
                ? initialData.budget_items
                : [{ name: '', description: '', quantity: 1, amount: 0, total: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: "budget_items" });
    const isBudgetMemo = watch('is_budget_memo');
    const budgetItems = watch('budget_items') || [];
    const grandTotal = budgetItems.reduce((acc, item) => acc + ((item.quantity || 0) * (item.amount || 0)), 0);

    const handleRemoveRequisition = () => {
        setValue('is_budget_memo', false);
        setValue('budget_category', '');
        setValue('other_category', '');
        setValue('budget_items', [{ name: '', budget_item_group: '', specific_item: '', description: '', quantity: 1, amount: 0, total: 0 }]);
        setIsBudgetModalOpen(false);
        toast.success('Financial Requisition attachment removed.');
    };


    const loadItemsForCategory = async (catNameOrId?: string | number) => {
        const key = catNameOrId ? String(catNameOrId) : 'all';
        if (categoryItems[key] && categoryItems[key].length > 0) return;
        setLoadingItems(true);
        const items = await getBudgetItemsByListId(catNameOrId);
        setCategoryItems(prev => ({ ...prev, [key]: items }));
        setLoadingItems(false);
    };


    useEffect(() => {
        if (Object.keys(errors).length > 0) console.log('Form Errors:', errors);
    }, [errors]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [years, categories, depts, curYear, initialItems] = await Promise.all([
                getBudgetYears(),
                getBudgetItemLists(),
                getDepartments(),
                getCurrentFiscalYear(),
                getBudgetItemsByListId()
            ]);
            setBudgetYears(years);
            setBudgetCategories(categories);
            setDepartments(depts);
            setCurrentYear(curYear);
            if (curYear) setValue('year_id', curYear.id);
            setCategoryItems({ all: initialItems });
        };
        fetchInitialData();
    }, [setValue]);

    const selectedRecipientIds = watch('recipient_ids') || [];
    const selectedCCIds = watch('cc_ids') || [];
    const selectedBCCIds = watch('bcc_ids') || [];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const toggleRecipient = (id: number, type: 'recipient_ids' | 'cc_ids' | 'bcc_ids') => {
        const current = watch(type) || [];
        setValue(type, current.includes(id) ? current.filter((rid: number) => rid !== id) : [...current, id]);
    };

    const handleSubmission = (data: MemoFormValues, isDraft: boolean) => {
        onSubmit({ ...data, attachments }, isDraft);
    };

    const onInvalid = (errors: any) => {
        const findMessage = (errObj: any): string | null => {
            if (!errObj) return null;
            if (errObj.message) return errObj.message;
            for (const key in errObj) {
                const nested = findMessage(errObj[key]);
                if (nested) return nested;
            }
            return null;
        };
        const message = findMessage(errors);
        toast.error(message || 'Please complete all required fields correctly.');
    };

    const totalSelected = selectedRecipientIds.length + selectedCCIds.length + selectedBCCIds.length;

    return (
        <form className="max-w-5xl mx-auto pb-20 font-sans space-y-4">

            {/* ── Top bar: type switcher + actions ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                {/* Memo type pill */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit">
                    <button
                        type="button"
                        onClick={() => setValue('is_budget_memo', false)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200',
                            !isBudgetMemo ? 'bg-[#1a365d] text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <FileTextIcon size={12} /> General Memo
                    </button>
                    <button
                        type="button"
                        onClick={() => setValue('is_budget_memo', true)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200',
                            isBudgetMemo ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20' : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <Wallet size={12} /> Budget Memo
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSubmit(data => handleSubmission(data, true), onInvalid)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm"
                    >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save Draft
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit(data => handleSubmission(data, false), onInvalid)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1a365d] text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50 outline-none"
                    >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        Route for Approval
                    </button>
                </div>
            </div>

            {/* ── Main compose card ── */}
            <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden">

                {/* Subject line */}
                <div className="px-6 py-4 border-b border-slate-100">
                    <input
                        {...register('title')}
                        className={cn(
                            'w-full bg-transparent outline-none text-base font-black text-[#1a365d] placeholder:text-slate-300 tracking-tight',
                            errors.title && 'placeholder:text-red-300'
                        )}
                        placeholder="Memo subject / title..."
                    />
                    {errors.title && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                            <AlertCircle size={10} /> {errors.title.message}
                        </p>
                    )}
                </div>

                {/* Recipients section */}
                <div className="px-6 py-2 border-b border-slate-100">
                    <RecipientRow
                        label="To"
                        fieldKey="recipient_ids"
                        recipients={recipients}
                        selectedIds={selectedRecipientIds}
                        onToggle={toggleRecipient}
                        color="blue"
                    />
                    <RecipientRow
                        label="CC"
                        fieldKey="cc_ids"
                        recipients={recipients}
                        selectedIds={selectedCCIds}
                        onToggle={toggleRecipient}
                        color="slate"
                    />
                    {showBCC ? (
                        <RecipientRow
                            label="BCC"
                            fieldKey="bcc_ids"
                            recipients={recipients}
                            selectedIds={selectedBCCIds}
                            onToggle={toggleRecipient}
                            color="purple"
                        />
                    ) : (
                        <div className="py-2 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-right w-8 text-slate-300">—</span>
                            <button
                                type="button"
                                onClick={() => setShowBCC(true)}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-purple-500 transition-colors"
                            >
                                + Add BCC
                            </button>
                        </div>
                    )}
                    {errors.recipient_ids && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 py-1">
                            <AlertCircle size={10} /> {errors.recipient_ids.message}
                        </p>
                    )}
                </div>

                {/* Metadata row — collapsible */}
                <div className="px-6 border-b border-slate-100">
                    <button
                        type="button"
                        onClick={() => setShowMeta(v => !v)}
                        className="flex items-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors w-full text-left"
                    >
                        <ChevronDown size={12} className={cn('transition-transform', showMeta && 'rotate-180')} />
                        Memo Metadata
                        <span className="ml-auto text-[9px] text-slate-300 font-bold normal-case tracking-normal">
                            {watch('department') || 'No dept'} · {watch('priority')} · {watch('memo_type')}
                        </span>
                    </button>
                    {showMeta && (
                        <div className="pb-5 pt-1 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Department */}
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Department</label>
                                <select
                                    {...register('department')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-blue-400 outline-none appearance-none transition-all"
                                >
                                    <option value="">Select Department...</option>
                                    {departments.map((dept, idx) => (
                                        <option key={idx} value={dept.name}>{dept.name}</option>
                                    ))}
                                </select>
                                {errors.department && <p className="text-[9px] text-red-500 font-bold">{errors.department.message}</p>}
                            </div>

                            {/* Category */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                                <select
                                    {...register('category')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-blue-400 outline-none appearance-none transition-all"
                                >
                                    <option value="">Select...</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Exams">Exams</option>
                                    <option value="Plumbing">Plumbing</option>
                                    <option value="Leave Request">Leave Request</option>
                                    <option value="Strategic Policy">Strategic Policy</option>
                                    <option value="General">General</option>
                                    <option value="Others">Others</option>
                                </select>
                                {errors.category && <p className="text-[9px] text-red-500 font-bold">{errors.category.message}</p>}
                            </div>

                            {/* Priority */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                                <select
                                    {...register('priority')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-blue-400 outline-none appearance-none transition-all"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            {/* Memo type */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                                <select
                                    {...register('memo_type')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-blue-400 outline-none appearance-none transition-all"
                                >
                                    <option value="Informational">Informational</option>
                                    <option value="Approval">Approval</option>
                                    <option value="Action">Action</option>
                                </select>
                            </div>

                            {/* Custom category (conditional) */}
                            {watch('category') === 'Others' && (
                                <div className="col-span-2 space-y-1.5 animate-in slide-in-from-top-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specify Category</label>
                                    <input
                                        {...register('custom_category')}
                                        placeholder="Enter custom category..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-blue-400 outline-none transition-all"
                                    />
                                    {errors.custom_category && <p className="text-[9px] text-red-500 font-bold">{errors.custom_category.message}</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Rich text body */}
                <div className="px-6 pt-4 pb-3">
                    <Controller
                        name="content"
                        control={control}
                        render={({ field }) => (
                            <RichTextEditor
                                content={field.value}
                                onChange={field.onChange}
                                className={cn('rounded-xl border-0', errors.content && 'border-red-200')}
                            />
                        )}
                    />
                    {errors.content && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-2">
                            <AlertCircle size={10} /> {errors.content.message}
                        </p>
                    )}
                </div>

                {/* Attachments list */}
                {attachments.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100">
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 group">
                                    <Paperclip size={12} className="text-slate-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-600 max-w-[160px] truncate">{file.name}</span>
                                    <span className="text-[9px] text-slate-400 font-bold">{(file.size / 1024).toFixed(0)}KB</span>
                                    <button
                                        type="button"
                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Budget Requisition Attachment Card (Visible on main card when Budget Memo is selected) ── */}
                {isBudgetMemo && (
                    <div className="px-6 pb-4 pt-1">
                        <div className={cn(
                            "p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                            budgetItems.length > 0 && budgetItems.some(i => i.name)
                                ? "bg-emerald-50/40 border-emerald-100/80 shadow-sm"
                                : "bg-slate-50/50 border-dashed border-slate-200"
                        )}>
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0",
                                    budgetItems.length > 0 && budgetItems.some(i => i.name)
                                        ? "bg-emerald-600 text-white shadow-emerald-600/20"
                                        : "bg-slate-300 text-white"
                                )}>
                                    <Wallet size={18} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-xs font-black text-[#1a365d] uppercase tracking-wider">
                                            Financial Requisition Details
                                        </h4>
                                        {watch('budget_category') && (
                                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                                                {watch('budget_category')}
                                            </span>
                                        )}
                                    </div>
                                    {budgetItems.length > 0 && budgetItems.some(i => i.name) ? (
                                        <>
                                            <p className="text-[10px] font-bold text-slate-500">
                                                {budgetItems.filter(i => i.name).length} item{budgetItems.filter(i => i.name).length !== 1 ? 's' : ''} listed for Fiscal Year: {currentYear?.name || 'Loading...'}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {budgetItems.filter(i => i.name).map((item, idx) => (
                                                    <span key={idx} className="bg-white border border-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                                                        {item.name} ({item.quantity}x)
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-[10px] font-bold text-slate-400">
                                            No expense line items added yet. Click setup to add items.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                                {(budgetItems.length > 0 && budgetItems.some(i => i.name)) && (
                                    <div className="text-right mr-1">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Calculated Expense</p>
                                        <p className="text-sm font-black text-emerald-700">
                                            NGN {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsBudgetModalOpen(true)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                                        budgetItems.length > 0 && budgetItems.some(i => i.name)
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10"
                                            : "bg-[#1a365d] hover:bg-[#2c5282] text-white shadow-blue-900/10"
                                    )}
                                >
                                    {budgetItems.length > 0 && budgetItems.some(i => i.name) ? 'Edit Requisition' : 'Add Requisition Items'}
                                </button>
                                {budgetItems.length > 0 && budgetItems.some(i => i.name) && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveRequisition}
                                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/60 flex items-center gap-1.5 shrink-0"
                                        title="Remove and delete requisition attachment"
                                    >
                                        <Trash2 size={13} />
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom toolbar */}
                <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                    {/* Attach file */}
                    <label className="cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1a365d] transition-colors">
                        <Paperclip size={15} />
                        Attach
                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>

                    <div className="w-px h-4 bg-slate-100" />

                    {/* Recipient count badge */}
                    {totalSelected > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            <UsersIcon size={12} />
                            {totalSelected} recipient{totalSelected !== 1 ? 's' : ''}
                        </span>
                    )}

                    <div className="ml-auto flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, true), onInvalid)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <Save size={12} /> Draft
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, false), onInvalid)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-5 py-2 bg-[#1a365d] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Route for Approval
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Budget Requisition Modal Overlay ── */}
            {isBudgetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-[96vw] max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                                    <Wallet size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-tight">Manage Budget Requisition</h3>
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Check size={10} className="text-emerald-500" />
                                            FY: {currentYear?.name || 'Active Fiscal Year'}
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                        Itemized expense breakdown & specific sub-item selections
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {budgetItems.length > 0 && budgetItems.some(i => i.name) && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveRequisition}
                                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                    >
                                        <Trash2 size={12} />
                                        Delete Requisition
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsBudgetModalOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6 flex-1 overflow-y-auto bg-slate-50/50">
                            {/* Budget Category Selection Card */}
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
                                <h4 className="text-[10px] font-black text-[#1a365d] uppercase tracking-widest">General Configuration</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Budget Category</label>
                                        <select
                                            {...register('budget_category', {
                                                onChange: (e) => {
                                                    const selectedName = e.target.value;
                                                    const cat = budgetCategories.find(c => c.name === selectedName);
                                                    loadItemsForCategory(cat ? cat.id : selectedName);
                                                }
                                            })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                        >
                                            <option value="">Select Budget Category...</option>
                                            {budgetCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                        {errors.budget_category && <p className="text-[9px] text-red-500 font-bold">{errors.budget_category.message}</p>}
                                    </div>
                                </div>
                                <input type="hidden" {...register('year_id')} />
                            </div>

                            {/* Budget line items section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[10px] font-black text-[#1a365d] uppercase tracking-widest">Budget Line Items</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            Select category above, then pick an item and enter quantity
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => append({ name: '', description: '', quantity: 1, amount: 0, total: 0 })}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                        <Plus size={12} />
                                        Add Line Item
                                    </button>
                                </div>

                                {fields.length === 0 ? (
                                    <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                                            <Wallet size={20} />
                                        </div>
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">No Requisition Line Items</p>
                                        <p className="text-[10px] text-slate-400 font-medium max-w-sm mx-auto">
                                            Click below to add itemized expenses for {watch('budget_category') || 'your budget memo'}.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => append({ name: '', description: '', quantity: 1, amount: 0, total: 0 })}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/10"
                                        >
                                            + Add Requisition Line Item
                                        </button>
                                    </div>
                                ) : (
                                    fields.map((field, index) => {
                                        // Determine which items are available for the selected category
                                        const selectedCatName = watch('budget_category');
                                        const cat = budgetCategories.find(c => c.name === selectedCatName);
                                        const catKey = cat ? String(cat.id) : (selectedCatName || 'all');
                                        const availableItems = (categoryItems[catKey] && categoryItems[catKey].length > 0)
                                            ? categoryItems[catKey]
                                            : (categoryItems['all'] || []);

                                        return (
                                            <div key={field.id} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 relative group shadow-sm hover:border-emerald-200 transition-all">
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center shadow-sm z-10 transition-all"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={12} />
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    {/* Item Selection Dropdown */}
                                                    <div className="md:col-span-8 space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                            Budget Item
                                                        </label>
                                                        <select
                                                            {...register(`budget_items.${index}.name`, {
                                                                onChange: (e) => {
                                                                    const selectedName = e.target.value;
                                                                    const matched = availableItems.find(i => i.name === selectedName);
                                                                    if (matched) {
                                                                        setValue(`budget_items.${index}.description`, matched.description || '');
                                                                        setValue(`budget_items.${index}.amount`, matched.amount || 0);
                                                                        const q = watch(`budget_items.${index}.quantity`) || 1;
                                                                        setValue(`budget_items.${index}.total`, q * (matched.amount || 0));
                                                                    }
                                                                }
                                                            })}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                                            disabled={!selectedCatName || loadingItems}
                                                        >
                                                            <option value="">
                                                                {loadingItems ? 'Loading items...' : selectedCatName ? 'Select Budget Item...' : 'Select a category first'}
                                                            </option>
                                                            {availableItems.map((item) => (
                                                                <option key={item.id} value={item.name}>{item.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Quantity */}
                                                    <div className="md:col-span-4 space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            {...register(`budget_items.${index}.quantity`, { valueAsNumber: true })}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                const val = raw === '' ? '' : parseInt(raw);
                                                                setValue(`budget_items.${index}.quantity`, val as any);
                                                                const q = typeof val === 'number' && !isNaN(val) ? val : 0;
                                                                const a = watch(`budget_items.${index}.amount`) || 0;
                                                                setValue(`budget_items.${index}.total`, q * a);
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Auto-filled Description (read-only) */}
                                                    {watch(`budget_items.${index}.description`) && (
                                                        <div className="md:col-span-12 space-y-1.5">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Description (from database)</label>
                                                            <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-600 font-medium">
                                                                {watch(`budget_items.${index}.description`)}
                                                            </div>
                                                            <input type="hidden" {...register(`budget_items.${index}.description`)} />
                                                        </div>
                                                    )}

                                                    {/* Unit Price (read-only from DB) and Subtotal */}
                                                    {(Number(watch(`budget_items.${index}.amount`) || 0) > 0) && (
                                                        <>
                                                            <div className="md:col-span-5 space-y-1.5">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Price (NGN) — from Budget</label>
                                                                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 flex items-center justify-between">
                                                                    <span>NGN</span>
                                                                    <span>{(watch(`budget_items.${index}.amount`) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                                <input type="hidden" {...register(`budget_items.${index}.amount`, { valueAsNumber: true })} />
                                                            </div>

                                                            <div className="md:col-span-7 space-y-1.5">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sub-Total (NGN)</label>
                                                                <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-700 flex items-center justify-between">
                                                                    <span>NGN</span>
                                                                    <span>{((watch(`budget_items.${index}.quantity`) || 0) * (watch(`budget_items.${index}.amount`) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Attachment */}
                                                    <div className="md:col-span-12 space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Attachment / Proforma Invoice (optional)</label>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="file"
                                                                id={`budget-item-file-${index}`}
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) setValue(`budget_items.${index}.file`, file);
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`budget-item-file-${index}`}
                                                                className={cn(
                                                                    'flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all',
                                                                    watch(`budget_items.${index}.file`)
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                                )}
                                                            >
                                                                <Paperclip size={12} />
                                                                {watch(`budget_items.${index}.file`)?.name || 'Attach Invoice / Quotation'}
                                                            </label>
                                                            {watch(`budget_items.${index}.file`) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setValue(`budget_items.${index}.file`, null)}
                                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white z-10">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Requisition Grand Total</span>
                                <span className="text-lg font-black text-[#1a365d]">
                                    NGN {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBudgetModalOpen(false)}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20"
                            >
                                Done & Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
