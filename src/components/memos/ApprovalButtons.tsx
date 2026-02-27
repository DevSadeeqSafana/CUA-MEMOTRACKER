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
    const [showApproveModal, setShowApproveModal] = useState(false);

    const handleApprove = async (comments: string = '') => {
        setIsLoading(true);
        try {
            const result = await approveMemo(memoId, approvalId, comments);
            if (result.success) {
                toast.success('Memo approved successfully');
                setIsCompleted(true);
                setShowApproveModal(false);
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
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-red-900/20"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                Reject
            </button>
            <button
                onClick={() => setShowApproveModal(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-emerald-900/20"
            >
                {isLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                Approve
            </button>

            <PromptModal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                onConfirm={handleReject}
                title="Reject Memo"
                description="Please provide a brief explanation for the rejection. This will be visible in the history."
                placeholder="Reason for rejection..."
                confirmText="Confirm Rejection"
                required
                isLoading={isLoading}
            />

            <PromptModal
                isOpen={showApproveModal}
                onClose={() => setShowApproveModal(false)}
                onConfirm={handleApprove}
                title="Approve Memo"
                description="Optional: Add a signature note or administrative comment to this approval."
                placeholder="Write a note (optional)..."
                confirmText="Approve Memo"
                isLoading={isLoading}
            />
        </div>
    );
}
