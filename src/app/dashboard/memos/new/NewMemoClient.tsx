'use client';

import { useState } from 'react';
import MemoForm from '@/components/memos/MemoForm';
import { createMemo } from '@/lib/actions';
import { useRouter } from 'next/navigation';

interface NewMemoClientProps {
    recipients: any[];
}

export default function NewMemoClient({ recipients }: NewMemoClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleFormSubmit = async (data: any, isDraft: boolean) => {
        setIsLoading(true);
        setError(null);

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
                router.push(`/dashboard/memos/${result.memoUuid}`);
            } else {
                setError(result.error || 'Something went wrong');
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            <MemoForm
                onSubmit={handleFormSubmit}
                isLoading={isLoading}
                recipients={recipients}
            />
        </>
    );
}
