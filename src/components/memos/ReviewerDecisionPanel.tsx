'use client';

import { useState } from 'react';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    FileSignature
} from 'lucide-react';
import { approveMemo, rejectMemo } from '@/lib/actions';
import { cn } from '@/lib/utils';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import toast from 'react-hot-toast';

interface ReviewerDecisionPanelProps {
    memoId: number;
    approvalId: number;
    memoTitle: string;
}

export default function ReviewerDecisionPanel({ memoId, approvalId, memoTitle }: ReviewerDecisionPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showRejectionForm, setShowRejectionForm] = useState(false);
    const [rejectionComments, setRejectionComments] = useState('');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);

    const handleApprove = async () => {
        setIsLoading(true);
        try {
            const result = await approveMemo(memoId, approvalId);
            if (result.success) {
                toast.success('Memo approved and distributed institutionally');
                setIsCompleted(true);
                setShowApproveConfirm(false);
            } else {
                toast.error((result as any).error || 'Failed to approve memo');
            }
        } catch (error) {
            console.error('Final decision failed:', error);
            toast.error('An unexpected error occurred during the decision process.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionComments.trim()) {
            toast.error('Please provide comments for the rejection.');
            return;
        }
        setIsLoading(true);
        try {
            const result = await rejectMemo(memoId, approvalId, rejectionComments);
            if (result.success) {
                toast.success('Memo rejected with comments');
                setIsCompleted(true);
            } else {
                toast.error((result as any).error || 'Failed to reject memo');
            }
        } catch (error) {
            console.error('Final decision failed:', error);
            toast.error('An unexpected error occurred during the decision process.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isCompleted) {
        return (
            <div className="bg-emerald-600 rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto border border-white/30 text-white">
                    <CheckCircle2 size={40} />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Decision Recorded</h2>
                    <p className="text-emerald-50/80 font-medium">The institutional workflow for this request has been successfully updated.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a365d] rounded-[3rem] shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors duration-700"></div>

            <div className="p-12 relative z-10 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/10 pb-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
                            <ShieldCheck size={32} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Final Decision Desk</h3>
                            <p className="text-blue-100/60 font-medium flex items-center gap-2">
                                <FileSignature size={14} />
                                Formal authorization required for institutional broadcasting.
                            </p>
                        </div>
                    </div>
                </div>

                {!showRejectionForm ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => setShowRejectionForm(true)}
                            disabled={isLoading}
                            className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-red-500/10 hover:border-red-500/30 transition-all group/red"
                        >
                            <XCircle size={32} className="text-red-400 mb-4 group-hover/red:scale-110 transition-transform" />
                            <span className="text-lg font-black text-white uppercase tracking-wider">Reject Request</span>
                            <p className="text-xs text-blue-200/40 mt-2 text-center">Formal disapproval with required audit comments.</p>
                        </button>

                        <button
                            onClick={() => setShowApproveConfirm(true)}
                            disabled={isLoading}
                            className="flex flex-col items-center justify-center p-8 bg-white text-[#1a365d] rounded-3xl hover:bg-blue-50 transition-all group/app shadow-xl shadow-black/20"
                        >
                            {isLoading ? <Loader2 size={32} className="animate-spin mb-4" /> : <CheckCircle2 size={32} className="text-emerald-600 mb-4 group-app:scale-110 transition-transform" />}
                            <span className="text-lg font-black uppercase tracking-wider">Approve & Distribute</span>
                            <p className="text-xs text-slate-400 mt-2 text-center">Digital signature for immediate institutional release.</p>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-300">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] ml-1">Rejection Comments (Required)</label>
                            <textarea
                                value={rejectionComments}
                                onChange={(e) => setRejectionComments(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white placeholder:text-white/20 focus:ring-4 focus:ring-red-500/20 focus:border-red-500/50 outline-none transition-all min-h-[120px]"
                                placeholder="State clearly the reason for institutional disapproval..."
                            />
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowRejectionForm(false)}
                                className="flex-1 py-4 px-6 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all uppercase tracking-widest text-[11px]"
                            >
                                Back to Options
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isLoading || !rejectionComments.trim()}
                                className="flex-[2] py-4 px-6 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                Confirm Institutional Rejection
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-start gap-4">
                    <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                    <p className="text-xs leading-relaxed text-blue-100/40 font-medium">
                        <span className="text-amber-400 font-bold uppercase tracking-tight mr-1">Institutional Warning:</span>
                        This decision is binding and will be recorded in the CUA Digital Archive. Approval will immediately broadcast this memo to all selected recipients.
                    </p>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showApproveConfirm}
                onClose={() => setShowApproveConfirm(false)}
                onConfirm={handleApprove}
                title="Institutional Approval"
                description={`Are you sure you want to provide FINAL approval for "${memoTitle}"? This will officially distribute the memo to all recipients and record your digital signature.`}
                confirmText="Approve & Distribute"
                variant="info"
                isLoading={isLoading}
            />
        </div>
    );
}
