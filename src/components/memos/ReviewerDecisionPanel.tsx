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
import PromptModal from '@/components/ui/PromptModal';
import toast from 'react-hot-toast';

interface ReviewerDecisionPanelProps {
    memoId: number;
    approvalId: number;
    memoTitle: string;
    memoUuid: string;
    currentUserId: number;
    currentUserName: string;
    consultations: any[];
    canForward: boolean;
    canAdjustRouting?: boolean;
    initialRecipients?: any[];
    initialApprovers?: any[];
    availableUsers?: any[];
    availableManagers?: any[];
}

import ConsultationThread from '@/components/memos/ConsultationThread';
import LineManagerRoutingAdjustment from '@/components/memos/LineManagerRoutingAdjustment';

export default function ReviewerDecisionPanel({
    memoId,
    approvalId,
    memoTitle,
    memoUuid,
    currentUserId,
    currentUserName,
    consultations,
    canForward,
    canAdjustRouting,
    initialRecipients,
    initialApprovers,
    availableUsers,
    availableManagers
}: ReviewerDecisionPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showRejectionForm, setShowRejectionForm] = useState(false);
    const [rejectionComments, setRejectionComments] = useState('');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);

    const handleApprove = async (comments: string = '') => {
        setIsLoading(true);
        try {
            const result = await approveMemo(memoId, approvalId, comments);
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
            <div className="bg-emerald-600 rounded-2xl p-8 text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto border border-white/30 text-white">
                    <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white font-outfit uppercase tracking-tight">Decision Recorded</h2>
                    <p className="text-emerald-50/80 text-[11px] font-medium">The institutional workflow for this request has been successfully updated.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a365d] rounded-2xl shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors duration-700"></div>

            <div className="p-8 relative z-10 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6 w-full">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
                            <ShieldCheck size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white font-outfit uppercase tracking-tight">Final Decision Desk</h3>
                            <p className="text-blue-100/60 text-[11px] font-medium flex items-center gap-2">
                                <FileSignature size={12} />
                                Formal authorization required for institutional broadcasting.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* If they have adjusting power, show the routing component */}
                        {canAdjustRouting && initialRecipients && initialApprovers && (
                            <LineManagerRoutingAdjustment
                                memoId={memoId}
                                initialRecipients={initialRecipients}
                                initialApprovers={initialApprovers}
                                availableUsers={availableUsers || []}
                                availableManagers={availableManagers || []}
                            />
                        )}
                        {canForward && (
                            <ConsultationThread
                                memoId={memoId}
                                memoUuid={memoUuid}
                                currentUserId={currentUserId}
                                currentUserName={currentUserName}
                                consultations={consultations}
                                canForward={canForward}
                                buttonOnly
                            />
                        )}
                    </div>
                </div>

                {!showRejectionForm ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => setShowRejectionForm(true)}
                            disabled={isLoading}
                            className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/10 hover:border-red-500/30 transition-all group/red"
                        >
                            <XCircle size={28} className="text-red-400 mb-3 group-hover/red:scale-110 transition-transform" />
                            <span className="text-base font-black text-white uppercase tracking-wider">Reject Request</span>
                            <p className="text-[10px] text-blue-200/40 mt-1.5 text-center">Formal disapproval with required audit comments.</p>
                        </button>

                        <button
                            onClick={() => setShowApproveConfirm(true)}
                            disabled={isLoading}
                            className="flex flex-col items-center justify-center p-6 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all group/app shadow-xl shadow-emerald-900/40 border border-emerald-500/50"
                        >
                            {isLoading ? <Loader2 size={28} className="animate-spin mb-3 text-emerald-100" /> : <CheckCircle2 size={28} className="text-emerald-100 mb-3 group-app:scale-110 transition-transform" />}
                            <span className="text-base font-black uppercase tracking-wider">Approve & Distribute</span>
                            <p className="text-[10px] text-white/60 mt-1.5 text-center">Digital signature for immediate institutional release.</p>
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

            <PromptModal
                isOpen={showApproveConfirm}
                onClose={() => setShowApproveConfirm(false)}
                onConfirm={handleApprove}
                title="Institutional Approval"
                description={`Provide final authorization for "${memoTitle}". You may add an optional administrative note to this distribution.`}
                confirmText="Approve & Distribute"
                placeholder="Administrative note (optional)..."
                isLoading={isLoading}
            />
        </div>
    );
}
