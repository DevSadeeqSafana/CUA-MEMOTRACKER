'use client';

import { useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendReceivedMemoToAccountant } from '@/lib/actions';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

interface SendToAccountantButtonProps {
    memoId: number;
    memoTitle: string;
}

// Lets an approver-group member send a memo they received (already
// distributed) to the Accountant's finance queue.
export default function SendToAccountantButton({ memoId, memoTitle }: SendToAccountantButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const handleSend = async () => {
        setIsLoading(true);
        try {
            const result = await sendReceivedMemoToAccountant(memoId);
            if (result.success) {
                toast.success('Memo sent to the Accountant');
                setIsSent(true);
                setShowConfirm(false);
            } else {
                toast.error(result.error || 'Failed to send memo to the Accountant');
            }
        } catch (error) {
            console.error('Send to accountant failed:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
        return (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white font-bold text-xs uppercase tracking-widest">
                <Landmark size={14} />
                Sent to Accountant
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-[#1a365d] hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-900/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <Landmark size={14} />}
                Send to Accountant
            </button>
            <ConfirmationModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleSend}
                title="Send to Accountant"
                description={`"${memoTitle}" will be marked as approved by you and placed in the Accountant's finance queue for processing.`}
                confirmText="Send to Accountant"
                variant="info"
                isLoading={isLoading}
            />
        </>
    );
}
