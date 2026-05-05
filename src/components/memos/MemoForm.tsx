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
    Search,
    FileText as FileTextIcon,
    Trash2
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { cn } from '@/lib/utils';
import { MemoPriority, MemoType } from '@/types/memo';
import { getBudgetItems, getBudgetYears, getBudgetItemLists, getBudgetItemNames, getDepartments, getCurrentFiscalYear } from '@/lib/actions';
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

export default function MemoForm({ initialData, onSubmit, isLoading, recipients = [] }: MemoFormProps) {
    const [attachments, setAttachments] = useState<File[]>([]);
    const [searchRecipient, setSearchRecipient] = useState('');
    const [searchCC, setSearchCC] = useState('');
    const [searchBCC, setSearchBCC] = useState('');

    const [budgetSearchTerm, setBudgetSearchTerm] = useState('');
    const [budgetItems, setBudgetItems] = useState<any[]>([]);
    const [isSearchingBudget, setIsSearchingBudget] = useState(false);
    const [selectedBudgetItem, setSelectedBudgetItem] = useState<any>(null);
    const [budgetYears, setBudgetYears] = useState<any[]>([]);
    const [budgetCategories, setBudgetCategories] = useState<any[]>([]);
    const [budgetItemNames, setBudgetItemNames] = useState<{ name: string, quantity: number, amount: number }[]>([]);
    const [departments, setDepartments] = useState<{ name: string }[]>([]);
    const [currentYear, setCurrentYear] = useState<{ id: string, name: string } | null>(null);

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

    const { fields, append, remove } = useFieldArray({
        control,
        name: "budget_items"
    });

    const isBudgetMemo = watch('is_budget_memo');

    useEffect(() => {
        if (Object.keys(errors).length > 0) {
            console.log('Form Validation Errors:', errors);
        }
    }, [errors]);


    useEffect(() => {
        const fetchInitialData = async () => {
            const [years, categories, names, depts, curYear] = await Promise.all([
                getBudgetYears(),
                getBudgetItemLists(),
                getBudgetItemNames(),
                getDepartments(),
                getCurrentFiscalYear()
            ]);
            setBudgetYears(years);
            setBudgetCategories(categories);
            setBudgetItemNames(names);
            setDepartments(depts);
            setCurrentYear(curYear);

            if (curYear) {
                setValue('year_id', curYear.id);
            }
        };
        fetchInitialData();
    }, [setValue]);

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

    const selectedRecipientIds = watch('recipient_ids') || [];
    const selectedCCIds = watch('cc_ids') || [];
    const selectedBCCIds = watch('bcc_ids') || [];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const toggleRecipient = (id: number, type: 'recipient_ids' | 'cc_ids' | 'bcc_ids') => {
        const current = watch(type) || [];
        if (current.includes(id)) {
            setValue(type, current.filter((rid: number) => rid !== id));
        } else {
            setValue(type, [...current, id]);
        }
    };

    const filteredRecipients = recipients.filter(r =>
        r.username.toLowerCase().includes(searchRecipient.toLowerCase()) ||
        r.department.toLowerCase().includes(searchRecipient.toLowerCase())
    );

    const handleSubmission = (data: MemoFormValues, isDraft: boolean) => {
        onSubmit({ ...data, attachments }, isDraft);
    };

    const onInvalid = (errors: any) => {
        console.error('Validation Errors:', errors);

        // Helper to find the first message in a potentially nested error object
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
        if (message) {
            toast.error(message);
        } else {
            toast.error('Please complete all required fields correctly.');
        }
    };

    return (
        <form className="space-y-8 max-w-6xl mx-auto pb-20 font-sans">
            {/* Header with Tab Switcher */}
            <div className="flex flex-col gap-4">
                {/* Top Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-[#1a365d]"></div>
                    <div className="ml-2 md:ml-4">
                        <h2 className="text-xl md:text-2xl font-black text-[#1a365d] font-outfit uppercase tracking-tighter">Memo Drafting Station</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">Institutional Communication & Financial Workflow</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, true), onInvalid)}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <Save size={14} />
                            Save Draft
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit(data => handleSubmission(data, false), onInvalid)}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-[#1a365d] text-white rounded-xl font-bold text-xs shadow-xl shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50 outline-none"
                        >
                            <Send size={14} />
                            Route for Approval
                        </button>
                    </div>
                </div>

                {/* Template Selection Tabs */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3 bg-white/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-fit">
                    <button
                        type="button"
                        onClick={() => setValue('is_budget_memo', false)}
                        className={cn(
                            "flex-1 sm:flex-none flex items-center justify-center gap-3 px-4 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
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
                            "flex-1 sm:flex-none flex items-center justify-center gap-3 px-4 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
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
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Current Fiscal Year</label>
                                    <div className="relative">
                                        <div className="w-full bg-slate-100/50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-500 flex items-center gap-3">
                                            <Check size={14} className="text-emerald-500" />
                                            {currentYear?.name || 'Loading Fiscal Period...'}
                                        </div>
                                        <input type="hidden" {...register('year_id')} />
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
                                                            <datalist id={`budget-item-names-${index}`}>
                                                                {budgetItemNames.map((item, idx) => (
                                                                    <option key={idx} value={item.name} />
                                                                ))}
                                                            </datalist>
                                                            <input
                                                                {...register(`budget_items.${index}.name`, {
                                                                    onChange: (e) => {
                                                                        const val = e.target.value;
                                                                        const matched = budgetItemNames.find(i => i.name === val);
                                                                        if (matched) {
                                                                            setValue(`budget_items.${index}.quantity`, matched.quantity);
                                                                            setValue(`budget_items.${index}.amount`, matched.amount);
                                                                            setValue(`budget_items.${index}.total`, matched.quantity * matched.amount);
                                                                        }
                                                                    }
                                                                })}
                                                                list={`budget-item-names-${index}`}
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
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Price (NGN )</label>
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
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-[#1a365d]">Sub-Total (NGN )</label>
                                                        <div className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-700 flex items-center">
                                                            NGN {((watch(`budget_items.${index}.quantity`) || 0) * (watch(`budget_items.${index}.amount`) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                    <div className="md:col-span-12 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item-Specific Attachment (Optional)</label>
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type="file"
                                                                id={`budget-item-file-${index}`}
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        setValue(`budget_items.${index}.file`, file);
                                                                    }
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`budget-item-file-${index}`}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all",
                                                                    watch(`budget_items.${index}.file`)
                                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                                                                )}
                                                            >
                                                                <Paperclip size={12} />
                                                                {watch(`budget_items.${index}.file`)?.name || 'Attach Invoice/Doc'}
                                                            </label>
                                                            {watch(`budget_items.${index}.file`) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setValue(`budget_items.${index}.file`, null)}
                                                                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Grand Total Display */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cumulative Financial Commitment</p>
                                            <p className="text-xs text-slate-400 font-medium italic">Aggregate total of all listed items above.</p>
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end">
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-2 sm:text-right">Grand Total</span>
                                            <div className="bg-[#1a365d] text-white px-8 py-4 rounded-[1.5rem] shadow-2xl shadow-blue-900/30 w-full sm:w-auto text-center">
                                                <span className="text-2xl md:text-3xl font-black">
                                                    NGN {(watch('budget_items') || []).reduce((acc, item) => acc + ((item.quantity || 0) * (item.amount || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-10">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                                    <UsersIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">Institutional Distribution</h3>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Authorized communication flow & visibility</p>
                                </div>
                            </div>
                            <div className="text-right bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Total Recipients</span>
                                <span className="text-lg font-black text-blue-600">{(selectedRecipientIds.length + selectedCCIds.length + selectedBCCIds.length)} Persons</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-10">
                            {/* To Recipients */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                        Primary Recipients (To)
                                    </label>
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{selectedRecipientIds.length}</span>
                                </div>
                                
                                <div className="flex gap-3">
                                    <div className="relative flex-grow group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by name or department..."
                                            value={searchRecipient}
                                            onChange={(e) => setSearchRecipient(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-sm font-bold text-[#1a365d] focus:bg-white focus:border-blue-500 transition-all outline-none"
                                        />
                                        
                                        {searchRecipient.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2">
                                                {recipients.filter(r => 
                                                    !selectedRecipientIds.includes(r.id) && 
                                                    (r.username.toLowerCase().includes(searchRecipient.toLowerCase()) || r.department.toLowerCase().includes(searchRecipient.toLowerCase()))
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-slate-400 font-bold uppercase tracking-widest italic">No matches found</div>
                                                ) : (
                                                    recipients.filter(r => 
                                                        !selectedRecipientIds.includes(r.id) && 
                                                        (r.username.toLowerCase().includes(searchRecipient.toLowerCase()) || r.department.toLowerCase().includes(searchRecipient.toLowerCase()))
                                                    ).map(user => (
                                                        <button
                                                            key={user.id}
                                                            type="button"
                                                            onClick={() => {
                                                                toggleRecipient(user.id, 'recipient_ids');
                                                                setSearchRecipient('');
                                                            }}
                                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-left transition-all group/item"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px] group-hover/item:bg-blue-100 group-hover/item:text-blue-600 transition-colors">
                                                                {user.username[0]}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700">{user.username}</p>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.department}</p>
                                                            </div>
                                                            <Plus size={14} className="ml-auto text-slate-300 group-hover/item:text-blue-500" />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        type="button"
                                        className="px-6 py-3.5 bg-[#1a365d] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/10 hover:bg-[#2c5282] transition-all whitespace-nowrap flex items-center gap-2"
                                        onClick={() => setSearchRecipient(searchRecipient || ' ')}
                                    >
                                        <Plus size={14} />
                                        Add Recipient
                                    </button>
                                </div>

                                {selectedRecipientIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {selectedRecipientIds.map(id => {
                                            const user = recipients.find(r => r.id === id);
                                            return user ? (
                                                <div key={id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl animate-in zoom-in-95">
                                                    <span className="text-[11px] font-bold text-blue-700">{user.username}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => toggleRecipient(id, 'recipient_ids')}
                                                        className="p-1 hover:bg-blue-100 rounded-lg text-blue-400 hover:text-blue-600 transition-all"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* CC & BCC Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* CC Recipients */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            Carbon Copy (CC)
                                        </label>
                                        <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{selectedCCIds.length}</span>
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-500" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Add CC..."
                                            value={searchCC}
                                            onChange={(e) => setSearchCC(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-400 transition-all outline-none"
                                        />
                                        
                                        {searchCC.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 max-h-[200px] overflow-y-auto p-2">
                                                {recipients.filter(r => 
                                                    !selectedCCIds.includes(r.id) && !selectedRecipientIds.includes(r.id) &&
                                                    (r.username.toLowerCase().includes(searchCC.toLowerCase()) || r.department.toLowerCase().includes(searchCC.toLowerCase()))
                                                ).map(user => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => {
                                                            toggleRecipient(user.id, 'cc_ids');
                                                            setSearchCC('');
                                                        }}
                                                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left transition-all"
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-black text-[9px]">
                                                            {user.username[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-slate-600">{user.username}</p>
                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{user.department}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCCIds.map(id => {
                                            const user = recipients.find(r => r.id === id);
                                            return user ? (
                                                <div key={id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg animate-in zoom-in-95">
                                                    <span className="text-[10px] font-bold text-slate-600">{user.username}</span>
                                                    <button type="button" onClick={() => toggleRecipient(id, 'cc_ids')} className="text-slate-400 hover:text-red-500">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                {/* BCC Recipients */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            Blind Copy (BCC)
                                        </label>
                                        <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{selectedBCCIds.length}</span>
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-500" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Add BCC..."
                                            value={searchBCC}
                                            onChange={(e) => setSearchBCC(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-400 transition-all outline-none"
                                        />
                                        
                                        {searchBCC.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 max-h-[200px] overflow-y-auto p-2">
                                                {recipients.filter(r => 
                                                    !selectedBCCIds.includes(r.id) && !selectedRecipientIds.includes(r.id) && !selectedCCIds.includes(r.id) &&
                                                    (r.username.toLowerCase().includes(searchBCC.toLowerCase()) || r.department.toLowerCase().includes(searchBCC.toLowerCase()))
                                                ).map(user => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => {
                                                            toggleRecipient(user.id, 'bcc_ids');
                                                            setSearchBCC('');
                                                        }}
                                                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left transition-all"
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-black text-[9px]">
                                                            {user.username[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-slate-600">{user.username}</p>
                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{user.department}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedBCCIds.map(id => {
                                            const user = recipients.find(r => r.id === id);
                                            return user ? (
                                                <div key={id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg animate-in zoom-in-95">
                                                    <span className="text-[10px] font-bold text-slate-600">{user.username}</span>
                                                    <button type="button" onClick={() => toggleRecipient(id, 'bcc_ids')} className="text-slate-400 hover:text-red-500">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {errors.recipient_ids && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                                <AlertCircle size={18} className="text-red-500" />
                                <p className="text-xs text-red-600 font-bold uppercase tracking-tight">{errors.recipient_ids.message}</p>
                            </div>
                        )}
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
                                    <option value="" className="text-slate-900">Select Department...</option>
                                    {departments.map((dept, idx) => (
                                        <option key={idx} value={dept.name} className="text-slate-900">{dept.name}</option>
                                    ))}
                                </select>
                                {errors.department && <p className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 ml-1 mt-2 tracking-tight"><AlertCircle size={12} /> {errors.department.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Classification</label>
                                <select
                                    {...register('category')}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none appearance-none"
                                >
                                    <option value="" className="text-slate-900">Select Classification...</option>
                                    <option value="Maintenance" className="text-slate-900">Maintenance</option>
                                    <option value="Exams" className="text-slate-900">Exams</option>
                                    <option value="Plumbing" className="text-slate-900">Plumbing</option>
                                    <option value="Leave Request" className="text-slate-900">Leave Request</option>
                                    <option value="Strategic Policy" className="text-slate-900">Strategic Policy</option>
                                    <option value="General" className="text-slate-900">General</option>
                                    <option value="Others" className="text-slate-900">Others</option>
                                </select>
                                {errors.category && <p className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 ml-1 mt-2 tracking-tight"><AlertCircle size={12} /> {errors.category.message}</p>}
                            </div>

                            {watch('category') === 'Others' && (
                                <div className="space-y-3 animate-in slide-in-from-top-2">
                                    <label className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Specify Classification</label>
                                    <input
                                        {...register('custom_category')}
                                        placeholder="Enter custom category..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white/10 focus:border-blue-400 transition-all outline-none"
                                    />
                                    {errors.custom_category && <p className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 ml-1 mt-2 tracking-tight"><AlertCircle size={12} /> {errors.custom_category.message}</p>}
                                </div>
                            )}

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
