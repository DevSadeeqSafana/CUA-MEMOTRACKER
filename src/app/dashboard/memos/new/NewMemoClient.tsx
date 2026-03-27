'use client';

import { useState } from 'react';
import MemoForm from '@/components/memos/MemoForm';
import { createMemo } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface NewMemoClientProps {
    recipients: any[];
}

export default function NewMemoClient({ recipients }: NewMemoClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleFormSubmit = async (data: any, isDraft: boolean) => {
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('title', data.title);
            formData.append('content', data.content);
            formData.append('department', data.department);
            formData.append('category', data.category);
            formData.append('priority', data.priority);
            formData.append('memo_type', data.memo_type);
            formData.append('expiry_date', data.expiry_date || '');
            formData.append('recipient_ids', JSON.stringify(data.recipient_ids));

            // Budget Fields
            formData.append('is_budget_memo', data.is_budget_memo ? 'true' : 'false');
            if (data.is_budget_memo) {
                formData.append('year_id', data.year_id || '');
                formData.append('budget_category', data.budget_category || '');
                formData.append('other_category', data.other_category || '');
                formData.append('budget_items', JSON.stringify(data.budget_items || []));
            }

            // Append files
            if (data.attachments && data.attachments.length > 0) {
                data.attachments.forEach((file: File) => {
                    formData.append('attachments', file);
                });
            }

            const result = await createMemo(formData, isDraft);

            if (result.success) {
                toast.success(isDraft ? 'Draft saved successfully' : 'Memo routed for approval');
                router.push(`/dashboard/memos/${result.memoUuid}`);
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
        <>

            <MemoForm
                onSubmit={handleFormSubmit}
                isLoading={isLoading}
                recipients={recipients}
            />
        </>
    );
}
