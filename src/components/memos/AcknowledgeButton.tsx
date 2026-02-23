'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { acknowledgeMemo } from '@/lib/actions';
import toast from 'react-hot-toast';

interface AcknowledgeButtonProps {
    memoId: number;
    isAcknowledged: boolean;
}

export default function AcknowledgeButton({ memoId, isAcknowledged }: AcknowledgeButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAcknowledge = async () => {
        setIsLoading(true);
        try {
            const result = await acknowledgeMemo(memoId);
            if (result.success) {
                toast.success('Memo acknowledged successfully');
            } else {
                toast.error((result as any).error || 'Failed to acknowledge memo');
            }
        } catch (error) {
            console.error('Acknowledgment failed:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isAcknowledged) {
        return (
            <div className="flex items-center gap-2 px-6 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
                <CheckCircle2 size={18} />
                Acknowledged
            </div>
        );
    }

    return (
        <button
            onClick={handleAcknowledge}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg shadow-md transition-all font-medium disabled:opacity-50"
        >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Acknowledge Memo
        </button>
    );
}
