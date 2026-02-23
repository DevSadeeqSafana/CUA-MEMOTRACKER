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
    Bell
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface MemoRoutingTrackerProps {
    memo: any;
    approvals: any[];
    recipients: any[];
}

type StepStatus = 'completed' | 'active' | 'pending' | 'rejected';

interface Step {
    id: string;
    label: string;
    sublabel: string;
    status: StepStatus;
    timestamp?: string | Date;
    note?: string;
}

export default function MemoRoutingTracker({ memo, approvals, recipients }: MemoRoutingTrackerProps) {
    const steps: Step[] = [];

    // Step 0: Memo Created
    steps.push({
        id: 'created',
        label: 'Submitted',
        sublabel: 'You',
        status: 'completed',
        timestamp: memo.created_at,
    });

    // Step 1..N: Each approval in the chain
    for (const app of approvals) {
        const appStatus: StepStatus =
            app.status === 'Approved' ? 'completed' :
                app.status === 'Rejected' ? 'rejected' :
                    // Is this the current pending step?
                    memo.status !== 'Distributed' && app.status === 'Pending' ? 'active' :
                        'pending';

        steps.push({
            id: `app-${app.id}`,
            label: app.status === 'Pending' ? 'Awaiting Review' : app.status,
            sublabel: app.approver_name,
            status: appStatus,
            timestamp: app.processed_at,
            note: app.comments || undefined,
        });
    }

    // Final Step: Distributed to recipients
    const totalRecipients = recipients.length;
    const acknowledgedCount = recipients.filter(r => r.acknowledged_at).length;
    const isDistributed = memo.status === 'Distributed';

    const recipientStatus: StepStatus =
        !isDistributed ? 'pending' :
            acknowledgedCount === totalRecipients && totalRecipients > 0 ? 'completed' :
                'active';

    steps.push({
        id: 'distributed',
        label: isDistributed
            ? `${acknowledgedCount}/${totalRecipients} Acknowledged`
            : 'Pending Distribution',
        sublabel: `${totalRecipients} Recipient(s)`,
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

    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div>
                    <h3 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight flex items-center gap-3">
                        <Send size={18} className="text-blue-500" />
                        Live Routing Tracker
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        Real-time status of your memo through the approval pipeline
                    </p>
                </div>
                <div className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border-2",
                    memo.status === 'Draft' && "bg-slate-50 border-slate-200 text-slate-400",
                    memo.status === 'Line Manager Review' && "bg-amber-50 border-amber-200 text-amber-700",
                    memo.status === 'Reviewer Approval' && "bg-blue-50 border-blue-200 text-blue-700",
                    memo.status === 'Distributed' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                )}>
                    {memo.status}
                </div>
            </div>

            {/* Pipeline Steps */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-0">
                {steps.map((step, idx) => (
                    <div key={step.id} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 flex-1 min-w-0">
                        {/* Step Node + connector row */}
                        <div className="flex sm:flex-row items-center w-full">
                            {/* Left connector */}
                            {idx > 0 && (
                                <div className={cn(
                                    "hidden sm:block flex-1 h-0.5",
                                    steps[idx - 1].status === 'completed' ? "bg-emerald-300" : "bg-slate-100"
                                )} />
                            )}

                            {/* Node */}
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-sm shrink-0 transition-all",
                                colorMap[step.status]
                            )}>
                                {idx === 0 ? <FilePlus size={20} /> :
                                    step.id === 'distributed' ? <Users size={20} /> :
                                        iconMap[step.status]}
                            </div>

                            {/* Right connector */}
                            {idx < steps.length - 1 && (
                                <div className={cn(
                                    "hidden sm:block flex-1 h-0.5",
                                    step.status === 'completed' ? "bg-emerald-300" : "bg-slate-100"
                                )} />
                            )}
                        </div>

                        {/* Mobile connector (vertical) */}
                        {idx < steps.length - 1 && (
                            <div className={cn(
                                "sm:hidden w-0.5 h-6 ml-6",
                                step.status === 'completed' ? "bg-emerald-300" : "bg-slate-100"
                            )} />
                        )}

                        {/* Label below node */}
                        <div className="sm:text-center mt-0 sm:mt-3 text-left pl-0 sm:pl-0 space-y-0.5 min-w-0 w-full sm:w-auto">
                            <p className={cn("text-[10px] font-black uppercase tracking-widest truncate", labelColorMap[step.status])}>
                                {step.label}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold truncate flex items-center gap-1">
                                <User size={9} />
                                {step.sublabel}
                            </p>
                            {step.timestamp && (
                                <p className="text-[9px] text-slate-300 font-bold">
                                    {formatDate(step.timestamp)}
                                </p>
                            )}
                            {step.note && (
                                <p className="text-[9px] text-red-400 font-bold italic truncate max-w-[100px]" title={step.note}>
                                    "{step.note}"
                                </p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {recipients.map((rec) => (
                            <div key={rec.recipient_id} className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                rec.acknowledged_at
                                    ? "bg-emerald-50 border-emerald-100"
                                    : "bg-slate-50 border-slate-100"
                            )}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0",
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
                                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                ) : (
                                    <Clock size={16} className="text-slate-300 shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
