'use client';

import { useState } from 'react';
import MemoForm from '@/components/memos/MemoForm';
import { updateDraftMemo } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface EditMemoClientProps {
    memo: any;
    memoId: number;
    existingRecipients: any[];
    budgetItems: any[];
    allRecipients: any[];
}

export default function EditMemoClient({
    memo,
    memoId,
    existingRecipients,
    budgetItems,
    allRecipients,
}: EditMemoClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Prepare initial data for MemoForm
    const initialData = {
        title: memo.title || '',
        department: memo.department || '',
        category: memo.category || '',
        priority: memo.priority || 'Medium',
        memo_type: memo.memo_type || 'Informational',
        expiry_date: memo.expiry_date
            ? new Date(memo.expiry_date).toISOString().split('T')[0]
            : '',
        content: memo.content || '',
        recipient_ids: existingRecipients
            .filter((r) => r.recipient_type === 'To')
            .map((r) => r.recipient_id),
        cc_ids: existingRecipients
            .filter((r) => r.recipient_type === 'CC')
            .map((r) => r.recipient_id),
        bcc_ids: existingRecipients
            .filter((r) => r.recipient_type === 'BCC')
            .map((r) => r.recipient_id),
        is_budget_memo: !!memo.year_id,
        year_id: memo.year_id ? String(memo.year_id) : '',
        budget_category: memo.budget_category || '',
        other_category: memo.other_category || '',
        budget_items: budgetItems.map((item) => ({
            name: item.name || '',
            description: item.description || '',
            quantity: Number(item.quantity) || 1,
            amount: Number(item.amount) || 0,
            total: Number(item.total) || 0,
        })),
    };

    const handleFormSubmit = async (data: any, isDraft: boolean) => {
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('title', data.title);
            formData.append('content', data.content);
            formData.append('department', data.department);
            formData.append('category', data.category);
            formData.append('custom_category', data.custom_category || '');
            formData.append('priority', data.priority);
            formData.append('memo_type', data.memo_type);
            formData.append('expiry_date', data.expiry_date || '');
            formData.append('recipient_ids', JSON.stringify(data.recipient_ids));
            formData.append('cc_ids', JSON.stringify(data.cc_ids || []));
            formData.append('bcc_ids', JSON.stringify(data.bcc_ids || []));

            // Budget Fields
            formData.append('is_budget_memo', data.is_budget_memo ? 'true' : 'false');
            if (data.is_budget_memo) {
                formData.append('year_id', data.year_id || '');
                formData.append('budget_category', data.budget_category || '');
                formData.append('other_category', data.other_category || '');

                // Process budget items: append files separately and remove from JSON
                const cleanedItems =
                    data.budget_items?.map((item: any, index: number) => {
                        if (item.file) {
                            formData.append(`budget_item_file_${index}`, item.file);
                        }
                        const { file, ...rest } = item;
                        return rest;
                    }) || [];

                formData.append('budget_items', JSON.stringify(cleanedItems));
            }

            // Append attachments
            if (data.attachments && data.attachments.length > 0) {
                data.attachments.forEach((file: File) => {
                    formData.append('attachments', file);
                });
            }

            // SubmitNow = !isDraft (if it's not a draft, route it for approval)
            const result = await updateDraftMemo(memoId, formData, !isDraft);

            if (result.success) {
                toast.success(isDraft ? 'Draft updated successfully' : 'Memo routed for approval');
                router.push(`/dashboard/memos/${result.memoUuid}`);
                router.refresh();
            } else {
                toast.error(result.error || 'Something went wrong');
            }
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto pb-10">
            <MemoForm
                initialData={initialData}
                onSubmit={handleFormSubmit}
                isLoading={isLoading}
                recipients={allRecipients}
            />
        </div>
    );
}
