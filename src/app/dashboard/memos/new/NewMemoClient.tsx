'use client';

import { useState } from 'react';
import MemoForm from '@/components/memos/MemoForm';
import { createMemo } from '@/lib/actions';
import { directUploadEnabled, uploadFilesDirect, MAX_ATTACHMENT_BYTES, formatBytes } from '@/lib/client-upload';
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
            const generalFiles: File[] = data.attachments || [];
            const itemFiles: { index: number; file: File }[] = (data.budget_items || [])
                .map((item: any, index: number) => ({ index, file: item.file }))
                .filter((x: any) => x.file instanceof File);
            const allFiles = [...generalFiles, ...itemFiles.map(x => x.file)];

            const oversized = allFiles.find(f => f.size > MAX_ATTACHMENT_BYTES);
            if (oversized) {
                toast.error(`"${oversized.name}" is ${formatBytes(oversized.size)}; attachments must be under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
                return;
            }

            // Send files straight to the backend first so the server action
            // only carries small JSON (Vercel rejects bodies over 4.5 MB).
            let uploadedGeneral: any[] = [];
            const uploadedItems = new Map<number, any>();
            const useDirect = directUploadEnabled() && allFiles.length > 0;
            if (useDirect) {
                const toastId = toast.loading(`Uploading attachments (0/${allFiles.length})…`);
                try {
                    const uploaded = await uploadFilesDirect(allFiles, (done, total) =>
                        toast.loading(`Uploading attachments (${done}/${total})…`, { id: toastId }));
                    uploadedGeneral = uploaded.slice(0, generalFiles.length);
                    itemFiles.forEach((x, i) => uploadedItems.set(x.index, uploaded[generalFiles.length + i]));
                    toast.dismiss(toastId);
                } catch (e: any) {
                    toast.error(e?.message || 'Attachment upload failed', { id: toastId });
                    return;
                }
            }

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
                const cleanedItems = data.budget_items?.map((item: any, index: number) => {
                    if (uploadedItems.has(index)) {
                        formData.append(`budget_item_upload_${index}`, JSON.stringify([uploadedItems.get(index)]));
                    } else if (item.file) {
                        formData.append(`budget_item_file_${index}`, item.file);
                    }
                    const { file, ...rest } = item;
                    return rest;
                }) || [];
                
                formData.append('budget_items', JSON.stringify(cleanedItems));
            }

            // Append files: metadata when already uploaded, otherwise the raw
            // files (local dev without the backend upload endpoint).
            if (useDirect) {
                formData.append('uploaded_attachments', JSON.stringify(uploadedGeneral));
            } else {
                generalFiles.forEach((file: File) => formData.append('attachments', file));
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
