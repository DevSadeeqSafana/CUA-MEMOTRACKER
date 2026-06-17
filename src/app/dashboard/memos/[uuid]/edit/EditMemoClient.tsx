'use client';

import { useState } from 'react';
import MemoForm from '@/components/memos/MemoForm';
import { updateRejectedMemo } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, Clock, User } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface RejectionRecord {
    id: number;
    comments: string;
    rejector_name: string;
    processed_at: string;
}

interface EditMemoClientProps {
    memo: any;
    memoId: number;
    memoUuid: string;
    rejections: RejectionRecord[];
    recipients: any[];
    initialData: any;
}

export default function EditMemoClient({
    memo,
    memoId,
    memoUuid,
    rejections,
    recipients,
    initialData,
}: EditMemoClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleFormSubmit = async (data: any, isDraft: boolean) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('title',           data.title);
            formData.append('content',         data.content);
            formData.append('department',      data.department);
            formData.append('category',        data.category);
            formData.append('custom_category', data.custom_category || '');
            formData.append('priority',        data.priority);
            formData.append('memo_type',       data.memo_type);
            formData.append('expiry_date',     data.expiry_date || '');
            formData.append('recipient_ids',   JSON.stringify(data.recipient_ids));
            formData.append('cc_ids',          JSON.stringify(data.cc_ids  || []));
            formData.append('bcc_ids',         JSON.stringify(data.bcc_ids || []));
            formData.append('is_budget_memo',  data.is_budget_memo ? 'true' : 'false');

            if (data.is_budget_memo) {
                formData.append('year_id',         data.year_id         || '');
                formData.append('budget_category', data.budget_category || '');
                formData.append('other_category',  data.other_category  || '');
                const cleanedItems = data.budget_items?.map((item: any) => {
                    const { file, ...rest } = item;
                    return rest;
                }) || [];
                formData.append('budget_items', JSON.stringify(cleanedItems));
            }

            const result = await updateRejectedMemo(memoId, formData, !isDraft);

            if (result.success) {
                toast.success(
                    isDraft
                        ? 'Changes saved as draft.'
                        : 'Memo resubmitted for review!'
                );
                router.push(`/dashboard/memos/${result.memoUuid}`);
            } else {
                toast.error(result.error || 'Something went wrong.');
            }
        } catch (err) {
            toast.error('An unexpected error occurred.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Back link */}
            <Link
                href={`/dashboard/memos/${memoUuid}`}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#1a365d] transition-all group px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
                <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
                Back to Memo
            </Link>

            {/* Rejection reason banner */}
            <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">
                            Memo Rejected — Revision Required
                        </p>
                        <p className="text-[11px] text-red-400 font-medium mt-0.5">
                            Address the issues below then save or resubmit.
                        </p>
                    </div>
                </div>

                <div className="divide-y divide-red-100">
                    {rejections.map((r) => (
                        <div key={r.id} className="px-6 py-4 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest">
                                    <User size={11} />
                                    {r.rejector_name}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                                    <Clock size={10} />
                                    {r.processed_at
                                        ? new Date(r.processed_at).toLocaleDateString('en-GB', {
                                              day: '2-digit', month: 'short', year: 'numeric',
                                              hour: '2-digit', minute: '2-digit',
                                          })
                                        : ''}
                                </div>
                            </div>
                            <p className="text-sm text-red-800 font-medium leading-relaxed bg-red-100/50 rounded-xl px-4 py-3 border border-red-100">
                                "{r.comments}"
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Page heading */}
            <div className="px-1">
                <h1 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">
                    Edit & Resubmit Memo
                </h1>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Make corrections based on the feedback above, then resubmit for review.
                </p>
            </div>

            {/* Reuse the exact same MemoForm with initialData */}
            <MemoForm
                initialData={initialData}
                onSubmit={handleFormSubmit}
                isLoading={isLoading}
                recipients={recipients}
            />
        </div>
    );
}
