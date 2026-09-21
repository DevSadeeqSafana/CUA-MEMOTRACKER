'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, ThumbsUp, Loader2 } from 'lucide-react';
import { acknowledgeMemo } from '@/lib/actions';
import toast from 'react-hot-toast';

interface AcknowledgeButtonProps {
    memoId: number;
    /** The recipient's recorded decision, if they have already acted. */
    decision: string | null;
    acknowledgedAt?: string | Date | null;
}

const formatWhen = (value?: string | Date | null) => {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AcknowledgeButton({ memoId, decision, acknowledgedAt }: AcknowledgeButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAcknowledge = async () => {
        setIsLoading(true);
        try {
            const result = await acknowledgeMemo(memoId);
            if (result.success) {
                toast.success('Receipt acknowledged');
            } else {
                toast.error((result as any).error || 'Failed to acknowledge memo');
            }
        } catch (error) {
            console.error('Acknowledge failed:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Already acted: show the outcome. "Approved"/"Rejected" here come from
    // an approver's decision (or older records), "Acknowledged" from a recipient.
    if (decision) {
        const when = formatWhen(acknowledgedAt);
        const tone = decision === 'Rejected'
            ? 'bg-red-50 text-red-700 border-red-200'
            : decision === 'Approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white/10 text-white border-white/20';
        const Icon = decision === 'Rejected' ? XCircle : decision === 'Approved' ? ThumbsUp : CheckCircle2;
        return (
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-widest ${tone}`}>
                <Icon size={16} />
                <span>You {decision.toLowerCase()} this memo{when ? ` · ${when}` : ''}</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleAcknowledge}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl shadow-lg shadow-emerald-900/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
        >
            {isLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            Acknowledge Receipt
        </button>
    );
}
