'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, ThumbsUp, Loader2 } from 'lucide-react';
import { acknowledgeMemo } from '@/lib/actions';
import toast from 'react-hot-toast';

interface AcknowledgeButtonProps {
    memoId: number;
    decision: string | null;
}

export default function AcknowledgeButton({ memoId, decision }: AcknowledgeButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAction = async (action: 'Acknowledged' | 'Approved' | 'Rejected') => {
        setIsLoading(true);
        try {
            const result = await acknowledgeMemo(memoId, action);
            if (result.success) {
                toast.success(`Memo ${action.toLowerCase()} successfully`);
            } else {
                toast.error((result as any).error || `Failed to ${action.toLowerCase()} memo`);
            }
        } catch (error) {
            console.error('Action failed:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (decision) {
        return (
            <div className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium shadow-sm ${decision === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                    decision === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-blue-50 text-[#1a365d] border border-blue-200'
                }`}>
                {decision === 'Rejected' ? <XCircle size={18} /> :
                    decision === 'Approved' ? <ThumbsUp size={18} /> :
                        <CheckCircle2 size={18} />}
                <span className="font-bold uppercase tracking-widest text-xs">{decision}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
                onClick={() => handleAction('Acknowledged')}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1a365d] text-white hover:bg-blue-800 rounded-xl shadow-lg shadow-blue-900/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                Acknowledge
            </button>
            <button
                onClick={() => handleAction('Approved')}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-900/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <ThumbsUp size={14} />}
                Approve
            </button>
            <button
                onClick={() => handleAction('Rejected')}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl shadow-lg shadow-red-900/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                Reject
            </button>
        </div>
    );
}
