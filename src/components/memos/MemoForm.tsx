'use client';

import { useState, useEffect } from 'react';
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
    Target,
    Loader2,
    FileText as FileTextIcon,
    Trash2
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { cn } from '@/lib/utils';
import { MemoPriority, MemoType } from '@/types/memo';
import { getBudgetItems, getBudgetYears, getBudgetItemLists } from '@/lib/actions';

const memoSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters'),
    department: z.string().min(1, 'Department is required'),
    category: z.string().min(1, 'Category is required'),
    priority: z.enum(['Low', 'Medium', 'High']),
    memo_type: z.enum(['Informational', 'Approval', 'Action']),
    expiry_date: z.string().optional(),
    content: z.string().min(20, 'Content is too short'),
    recipient_ids: z.array(z.number()).min(1, 'Please select at least one recipient'),
    is_budget_memo: z.boolean().default(false),
    year_id: z.string().optional(),
    budget_category: z.string().optional(),
    other_category: z.string().optional(),
    budget_items: z.array(z.object({
        name: z.string().min(1, 'Item name is required'),
        description: z.string().optional(),
        quantity: z.number().min(1),
        amount: z.number().min(0),
        total: z.number().optional(),
    })).optional(),
}).refine(data => {
    if (data.is_budget_memo) {
        return !!data.year_id && !!data.budget_category && (data.budget_items?.length || 0) > 0;
    }
    return true;
}, {
    message: "Budget details (Year, Category, and Items) are required",
    path: ["year_id"]
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

    const [budgetSearchTerm, setBudgetSearchTerm] = useState('');
    const [budgetItems, setBudgetItems] = useState<any[]>([]);
    const [isSearchingBudget, setIsSearchingBudget] = useState(false);
    const [selectedBudgetItem, setSelectedBudgetItem] = useState<any>(null);
    const [budgetYears, setBudgetYears] = useState<any[]>([]);
    const [budgetCategories, setBudgetCategories] = useState<any[]>([]);

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
            is_budget_memo: initialData?.is_budget_memo || false,
            year_id: initialData?.year_id || '',
            budget_category: initialData?.budget_category || '',
            other_category: initialData?.other_category || '',
            budget_items: initialData?.budget_items || [{ name: '', description: '', quantity: 1, amount: 0, total: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "budget_items"
    });

    const isBudgetMemo = watch('is_budget_memo');


    useEffect(() => {
        const fetchInitialData = async () => {
            const [years, categories] = await Promise.all([
                getBudgetYears(),
                getBudgetItemLists()
            ]);
            setBudgetYears(years);
            setBudgetCategories(categories);
        };
        fetchInitialData();
    }, []);

    const selectedYear = watch('year_id');

    useEffect(() => {
        if (budgetSearchTerm.length < 2) {
            setBudgetItems([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingBudget(true);
            const results = await getBudgetItems(budgetSearchTerm, selectedYear);
            setBudgetItems(results);
            setIsSearchingBudget(false);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [budgetSearchTerm, selectedYear]);

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

    const handleSubmission = (data: MemoFormValues, isDraft: boolean) => {
        onSubmit({ ...data, attachments }, isDraft);
    };

    return (
        <form className="space-y-8 max-w-6xl mx-auto pb-20 font-sans">
            {/* Header with Tab Switcher */}
            <div className="flex flex-col gap-4">
                {/* Top Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-[#1a365d]"></div>
                    <div className="ml-4">
                        <h2 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tighter">Memo Drafting Station</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">Institutional Communication & Financial Workflow</p>
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, true))}
                            disabled={isLoading}
                            className="flex items-center gap-3 px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <Save size={14} />
                            Save Draft
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, false))}
                            disabled={isLoading}
                            className="flex items-center gap-3 px-5 py-2 bg-[#1a365d] text-white rounded-xl font-bold text-xs shadow-xl shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50 outline-none"
                        >
                            <Send size={14} />
                            Route for Approval
                        </button>
                    </div>
                </div>

                {/* Template Selection Tabs */}
                <div className="flex items-center gap-3 bg-white/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm max-w-fit">
                    <button
                        type="button"
                        onClick={() => setValue('is_budget_memo', false)}
                        className={cn(
                            "flex items-center gap-3 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            !isBudgetMemo
                                ? "bg-[#1a365d] text-white shadow-xl shadow-blue-900/20"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        <FileTextIcon size={14} />
                        General Memo
                    </button>
                    <button
                        type="button"
                        onClick={() => setValue('is_budget_memo', true)}
                        className={cn(
                            "flex items-center gap-3 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            isBudgetMemo
                                ? "bg-emerald-600 text-white shadow-xl shadow-emerald-900/20"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        <Wallet size={14} />
                        Budget Memo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Memo Subject / Title</label>
                            <input
                                {...register('title')}
                                className={cn(
                                    "w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-[#1a365d] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none",
                                    errors.title && "border-red-300 ring-4 ring-red-500/10"
                                )}
                                placeholder="Formal subject heading..."
                            />
                            {errors.title && <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 ml-1"><AlertCircle size={14} /> {errors.title.message}</p>}
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Official Content</label>
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

                    {/* Tab-Specific Content: Budget Section */}
                    {isBudgetMemo && (
                        <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm space-y-6 overflow-hidden animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <Wallet size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-[#1a365d] font-outfit uppercase tracking-wider">Financial Request Details</h3>
                                        <p className="text-xs text-slate-400 font-medium mt-1">Collection of institutional budget data for transparency.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Budget Year</label>
                                    <div className="relative">
                                        <select
                                            {...register('year_id')}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold focus:border-blue-500 transition-all outline-none appearance-none"
                                        >
                                            <option value="">Select Fiscal Year...</option>
                                            {budgetYears.map(year => (
                                                <option key={year.id} value={year.id.toString()}>{year.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronRight size={14} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Budget Category</label>
                                    <div className="relative">
                                        <select
                                            {...register('budget_category')}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold focus:border-blue-500 transition-all outline-none appearance-none"
                                        >
                                            <option value="">Select Category...</option>
                                            {budgetCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                            <option value="Others">Others</option>
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronRight size={14} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {watch('budget_category') === 'Others' && (
                                    <div className="space-y-2 md:col-span-2 animate-in slide-in-from-top-2">
                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] ml-1">Specify Other Category</label>
                                        <input
                                            {...register('other_category')}
                                            className="w-full bg-emerald-50/30 border border-emerald-100 rounded-xl px-5 py-3 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                                            placeholder="Please define the category..."
                                        />
                                    </div>
                                )}

                                <div className="md:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <Plus size={16} />
                                            </div>
                                            <h4 className="text-sm font-black text-[#1a365d] uppercase tracking-wider">Budget Line Items</h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => append({ name: '', description: '', quantity: 1, amount: 0, total: 0 })}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10"
                                        >
                                            Add New Row
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4 relative group">
                                                {fields.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(index)}
                                                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-500 flex items-center justify-center transition-all shadow-sm z-10"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-12 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Name (Search or Type)</label>
                                                        <div className="relative">
                                                            <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                            <input
                                                                {...register(`budget_items.${index}.name`)}
                                                                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                                                placeholder="e.g. Office Equipment Procurement"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="md:col-span-12 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detailed Description</label>
                                                        <textarea
                                                            {...register(`budget_items.${index}.description`)}
                                                            rows={2}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:border-emerald-500 outline-none transition-all resize-none"
                                                            placeholder="Specific details about this requirement..."
                                                        />
                                                    </div>

                                                    <div className="md:col-span-3 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty</label>
                                                        <input
                                                            type="number"
                                                            {...register(`budget_items.${index}.quantity`, { valueAsNumber: true })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                                            onChange={(e) => {
                                                                const q = parseInt(e.target.value) || 0;
                                                                const a = watch(`budget_items.${index}.amount`) || 0;
                                                                setValue(`budget_items.${index}.total`, q * a);
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Price (₦)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            {...register(`budget_items.${index}.amount`, { valueAsNumber: true })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
                                                            onChange={(e) => {
                                                                const a = parseFloat(e.target.value) || 0;
                                                                const q = watch(`budget_items.${index}.quantity`) || 0;
                                                                setValue(`budget_items.${index}.total`, q * a);
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-5 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-[#1a365d]">Sub-Total (₦)</label>
                                                        <div className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-700 flex items-center">
                                                            ₦{((watch(`budget_items.${index}.quantity`) || 0) * (watch(`budget_items.${index}.amount`) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Grand Total Display */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cumulative Financial Commitment</p>
                                            <p className="text-xs text-slate-400 font-medium italic">Aggregate total of all listed items above.</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Grand Total</span>
                                            <div className="bg-[#1a365d] text-white px-8 py-4 rounded-[1.5rem] shadow-2xl shadow-blue-900/30">
                                                <span className="text-2xl font-black">
                                                    ₦{(watch('budget_items') || []).reduce((acc, item) => acc + ((item.quantity || 0) * (item.amount || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {errors.year_id && <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 ml-1 mt-4"><AlertCircle size={14} /> {errors.year_id.message}</p>}
                        </div>
                    )}

                    {/* Recipient Selection Section */}
                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <UsersIcon size={16} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-[#1a365d] font-outfit uppercase tracking-wider">Distribution List</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Select authorized recipients for this memo.</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Selected</span>
                                <span className="text-base font-black text-blue-600">{selectedRecipientIds.length} Persons</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Filter by name or department..."
                                    value={searchRecipient}
                                    onChange={(e) => setSearchRecipient(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-5 text-xs font-medium outline-none focus:border-blue-500 transition-all"
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

                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={16} />
                                Supplemental Documentation
                            </h3>
                            <label className="cursor-pointer px-5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#1a365d] hover:bg-slate-100 transition-all">
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
        </form >
    );
}
