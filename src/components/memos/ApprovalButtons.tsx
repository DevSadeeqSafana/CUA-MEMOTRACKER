'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { approveMemo, rejectMemo } from '@/lib/actions';
import PromptModal from '@/components/ui/PromptModal';
import toast from 'react-hot-toast';

interface ApprovalButtonsProps {
    memoId: number;
    approvalId: number;
}

export default function ApprovalButtons({ memoId, approvalId }: ApprovalButtonsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);

    const handleApprove = async () => {
        setIsLoading(true);
        try {
            const result = await approveMemo(memoId, approvalId);
            if (result.success) {
                toast.success('Memo approved successfully');
                setIsCompleted(true);
            } else {
                toast.error((result as any).error || 'Failed to approve memo');
            }
        } catch (error) {
            console.error('Approve failed:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async (comments: string) => {
        setIsLoading(true);
        try {
            const result = await rejectMemo(memoId, approvalId, comments);
            if (result.success) {
                toast.success('Memo rejected with comments');
                setIsCompleted(true);
                setShowRejectModal(false);
            } else {
                toast.error((result as any).error || 'Failed to reject memo');
            }
        } catch (error) {
            console.error('Reject failed:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (isCompleted) {
        return (
            <div className="flex items-center gap-3 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 text-white font-bold animate-in zoom-in-95">
                <CheckCircle2 size={18} className="text-emerald-400" />
                Action Processed
            </div>
        );
    }

    return (
        <div className="flex gap-3 shrink-0">
            <button
                onClick={() => setShowRejectModal(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 border border-destructive/20 text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-medium disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                Reject
            </button>
            <button
                onClick={handleApprove}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg shadow-md transition-all font-medium disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Approve
            </button>

            <PromptModal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                onConfirm={handleReject}
                title="Reject Memo"
                description="Please provide a brief explanation for the rejection. This will be visible in the history."
                placeholder="Reason for rejection..."
                confirmText="Reject Memo"
                required
                isLoading={isLoading}
            />
        </div>
    );
}
