'use client';

import {
    FilePlus,
    CheckCircle2,
    Clock,
    XCircle,
    Send,
    Users,
    ArrowRight,
    User,
    Bell,
    ShieldCheck
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface MemoRoutingTrackerProps {
    memo: any;
    approvals: any[];
    recipients: any[];
    currentUserId?: number;
}

type StepStatus = 'completed' | 'active' | 'pending' | 'rejected';

interface Step {
    id: string;
    label: string;
    sublabel: string;
    status: StepStatus;
    timestamp?: string | Date;
    note?: string;
    isCurrentUser?: boolean;
}

export default function MemoRoutingTracker({ memo, approvals, recipients, currentUserId }: MemoRoutingTrackerProps) {
    const steps: Step[] = [];

    // Step 0: Memo Created
    const isCreator = currentUserId === memo.created_by;
    steps.push({
        id: 'created',
        label: 'Memo Entry',
        sublabel: isCreator ? 'You (Submitter)' : memo.creator_name,
        status: 'completed',
        timestamp: memo.created_at,
        isCurrentUser: isCreator
    });

    // Step 1..N: Each approval in the chain
    let foundActive = false;
    for (const app of approvals) {
        let appStatus: StepStatus = 'pending';
        const isCurrentApprover = currentUserId === app.approver_id;

        if (app.status === 'Approved') {
            appStatus = 'completed';
        } else if (app.status === 'Rejected') {
            appStatus = 'rejected';
        } else if (app.status === 'Pending' && !foundActive && memo.status !== 'Distributed') {
            appStatus = 'active';
            foundActive = true;
        }

        steps.push({
            id: `app-${app.id}`,
            label: app.status === 'Pending'
                ? (appStatus === 'active' ? 'Under Review' : 'Queue Position')
                : (app.status === 'Approved' ? 'Validated' : 'Disapproved'),
            sublabel: isCurrentApprover ? 'You (Approver)' : app.approver_name,
            status: appStatus,
            timestamp: app.processed_at,
            note: app.comments || undefined,
            isCurrentUser: isCurrentApprover
        });
    }

    // Final Step: Distributed to recipients
    const totalRecipients = recipients.length;
    const acknowledgedCount = recipients.filter(r => r.acknowledged_at).length;
    const isDistributed = memo.status === 'Distributed';
    const isOneOfRecipients = recipients.some(r => r.recipient_id === currentUserId);

    const recipientStatus: StepStatus =
        !isDistributed ? 'pending' :
            acknowledgedCount === totalRecipients && totalRecipients > 0 ? 'completed' :
                'active';

    steps.push({
        id: 'distributed',
        label: isDistributed
            ? `Broadcasted`
            : 'Distribution Pending',
        sublabel: isOneOfRecipients ? `You & ${totalRecipients - 1} others` : `${totalRecipients} Recipient(s)`,
        status: recipientStatus,
        timestamp: isDistributed ? memo.updated_at : undefined,
    });

    const iconMap: Record<StepStatus, React.ReactNode> = {
        completed: <CheckCircle2 size={20} />,
        active: <Clock size={20} />,
        pending: <Clock size={20} />,
        rejected: <XCircle size={20} />,
    };

    const colorMap: Record<StepStatus, string> = {
        completed: 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-900/20',
        active: 'bg-amber-400 text-white border-amber-300 shadow-amber-900/20 animate-pulse',
        pending: 'bg-slate-100 text-slate-400 border-slate-200',
        rejected: 'bg-red-500 text-white border-red-400 shadow-red-900/20',
    };

    const labelColorMap: Record<StepStatus, string> = {
        completed: 'text-emerald-700',
        active: 'text-amber-700',
        pending: 'text-slate-400',
        rejected: 'text-red-700',
    };

    const completedSteps = steps.filter(s => s.status === 'completed' || s.status === 'rejected').length;
    const progressPercentage = (completedSteps / steps.length) * 100;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/50 space-y-8 relative overflow-hidden group">
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:bg-blue-50 transition-colors duration-700"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <Send size={16} />
                        </div>
                        Routing Pipeline
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                        Real-time verification and acknowledgment status.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-2xl border-2 shadow-sm",
                        memo.status === 'Draft' && "bg-slate-50 border-slate-200 text-slate-400",
                        memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                        memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                        memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}>
                        Phase: {memo.status}
                    </div>
                </div>
            </div>

            {/* Progress Bar Summary */}
            <div className="relative z-10 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Validation Progress</span>
                    <span className="text-blue-600">{Math.round(progressPercentage)}% Complete</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* Pipeline Steps */}
            <div className="flex flex-col sm:flex-row items-start lg:items-center gap-0 relative z-10 py-4">
                {steps.map((step, idx) => (
                    <div key={step.id} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 flex-1 min-w-0 group/step">
                        {/* Step Node + connector row */}
                        <div className="flex sm:flex-row items-center w-full">
                            {/* Left connector */}
                            {idx > 0 && (
                                <div className={cn(
                                    "hidden sm:block flex-1 h-1 transition-all duration-700",
                                    steps[idx - 1].status === 'completed' ? "bg-emerald-400" : "bg-slate-100"
                                )} />
                            )}

                            {/* Node */}
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0 transition-all duration-300 relative",
                                colorMap[step.status],
                                step.status === 'active' && "scale-110 ring-4 ring-amber-500/20",
                                step.isCurrentUser && "border-blue-600 border-[2px]"
                            )}>
                                {step.isCurrentUser && (
                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                                        <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                    </div>
                                )}
                                {idx === 0 ? <FilePlus size={16} /> :
                                    step.id === 'distributed' ? <Users size={16} /> :
                                        iconMap[step.status]}
                            </div>

                            {/* Right connector */}
                            {idx < steps.length - 1 && (
                                <div className={cn(
                                    "hidden sm:block flex-1 h-1 transition-all duration-700",
                                    step.status === 'completed' ? "bg-emerald-400" : "bg-slate-100"
                                )} />
                            )}
                        </div>

                        {/* Mobile connector (vertical) */}
                        {idx < steps.length - 1 && (
                            <div className={cn(
                                "sm:hidden w-1 h-10 ml-5 my-1 transition-all duration-700",
                                step.status === 'completed' ? "bg-emerald-400" : "bg-slate-100"
                            )} />
                        )}

                        {/* Label below node */}
                        <div className="sm:text-center mt-0 sm:mt-4 text-left pl-0 sm:pl-0 space-y-1 min-w-0 w-full sm:w-auto px-1">
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-[0.1em] truncate group-hover/step:translate-y-[-1px] transition-transform",
                                labelColorMap[step.status]
                            )}>
                                {step.label}
                            </p>
                            <p className={cn(
                                "text-[9px] font-bold truncate flex items-center justify-start sm:justify-center gap-1.5",
                                step.isCurrentUser ? "text-blue-600" : "text-slate-500"
                            )}>
                                {step.isCurrentUser ? (
                                    <ShieldCheck size={9} className="text-blue-600" />
                                ) : (
                                    <User size={9} className="opacity-40" />
                                )}
                                {step.sublabel}
                            </p>
                            {step.timestamp && (
                                <p className="text-[9px] text-slate-400 font-bold opacity-0 group-hover/step:opacity-100 transition-opacity">
                                    {formatDate(step.timestamp)}
                                </p>
                            )}
                            {step.note && (
                                <div className={cn(
                                    "mt-3 p-3 rounded-[1rem] text-[9.5px] font-bold leading-relaxed border shadow-sm animate-in fade-in slide-in-from-top-1 duration-500 flex items-start gap-2 max-w-[200px] mx-auto",
                                    step.status === 'rejected'
                                        ? "bg-red-50 border-red-100 text-red-700 shadow-red-100/20"
                                        : "bg-blue-50 border-blue-100 text-blue-700 shadow-blue-100/20"
                                )}>
                                    <ShieldCheck size={12} className="mt-0.5 shrink-0 opacity-40" />
                                    <div className="text-left">
                                        <span className="opacity-40 mr-1 uppercase text-[8px] font-black tracking-widest">Decision Note:</span>
                                        <span className="italic">"{step.note}"</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Recipient Acknowledgment Grid */}
            {isDistributed && recipients.length > 0 && (
                <div className="border-t border-slate-100 pt-8 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                        <Bell size={12} />
                        Recipient Treatment Status
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {recipients.map((rec) => (
                            <div key={rec.recipient_id} className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition-all",
                                rec.acknowledged_at
                                    ? "bg-emerald-50 border-emerald-100"
                                    : "bg-slate-50 border-slate-100"
                            )}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0",
                                        rec.acknowledged_at ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-500"
                                    )}>
                                        {rec.recipient_name[0]}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-slate-700 truncate">{rec.recipient_name}</p>
                                        {rec.acknowledged_at && (
                                            <p className="text-[9px] text-emerald-600 font-bold">
                                                Acknowledged {formatDate(rec.acknowledged_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {rec.acknowledged_at ? (
                                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                ) : (
                                    <Clock size={14} className="text-slate-200 shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
