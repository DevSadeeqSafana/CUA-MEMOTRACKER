'use client';

import {
    CheckCircle2,
    Clock,
    XCircle,
    Eye,
    User,
    ArrowDown,
    FilePlus,
    Send
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface TimelineEvent {
    id: string | number;
    type: 'creation' | 'approval' | 'rejection' | 'distribution' | 'acknowledgment';
    title: string;
    description: string;
    timestamp: string | Date;
    status: 'completed' | 'pending' | 'failed';
    user?: string;
}

interface MemoHistoryProps {
    memo: any;
    approvals: any[];
    recipients: any[];
    routingLogs?: any[];
    consultations?: any[];
}

export default function MemoHistory({ memo, approvals, recipients, routingLogs = [], consultations = [] }: MemoHistoryProps) {
    // Build timeline events
    const events: TimelineEvent[] = [];

    // 1. Creation
    events.push({
        id: 'creation',
        type: 'creation',
        title: 'Memo Initiated',
        description: `Drafted and submitted by ${memo.creator_name}`,
        timestamp: memo.created_at,
        status: 'completed',
        user: memo.creator_name
    });

    routingLogs.forEach((log) => {
        // MySQL JSON columns may already be parsed as objects by the driver
        let details: Record<string, any> = {};
        try {
            if (log.new_value === null || log.new_value === undefined) {
                details = {};
            } else if (typeof log.new_value === 'string') {
                details = JSON.parse(log.new_value);
            } else if (typeof log.new_value === 'object') {
                details = log.new_value;
            }
        } catch (e) {
            details = {};
        }

        const actor = log.action_by_name || 'Your line manager';

        let descriptions: string[] = [];

        // Recipient change with full from/to context (preferred path)
        const oldR = (details.oldRecipients || '').trim();
        const newR = (details.newRecipients || '').trim();
        if (oldR && newR && oldR !== newR) {
            descriptions.push(`${actor} changed the recipient from "${oldR}" to "${newR}".`);
        } else if ((details.addedRecipients || '').trim()) {
            descriptions.push(`${actor} added "${details.addedRecipients.trim()}" as recipient(s).`);
        } else if ((details.removedRecipients || '').trim()) {
            descriptions.push(`${actor} removed "${details.removedRecipients.trim()}" from the distribution.`);
        }

        // Approver addition
        if ((details.addedApprovers || '').trim()) {
            descriptions.push(`${actor} added "${details.addedApprovers.trim()}" as an approver to this memo.`);
        }

        const desc = descriptions.length > 0
            ? descriptions.join(' ')
            : `Routing was adjusted by ${actor}.`;

        events.push({
            id: `routing-${log.id}`,
            type: 'approval',
            title: 'Routing Adjusted by Manager',
            description: desc,
            timestamp: log.timestamp,
            status: 'completed',
            user: log.action_by_name
        });
    });

    // 2. Approvals
    approvals.forEach((app) => {
        events.push({
            id: `app-${app.id}`,
            type: app.status === 'Rejected' ? 'rejection' : 'approval',
            title: `Level ${app.step_order}: ${app.status === 'Pending' ? 'Review Required' : 'Review Decision'}`,
            description: app.status === 'Pending'
                ? `Awaiting signature from ${app.approver_name}`
                : `${app.status} by ${app.approver_name}${app.comments ? `: ${app.comments}` : ''}`,
            timestamp: app.processed_at || memo.created_at,
            status: app.status === 'Approved' ? 'completed' : app.status === 'Rejected' ? 'failed' : 'pending',
            user: app.approver_name
        });
    });

    // 3. Consultations / Forwards
    consultations.forEach((c) => {
        events.push({
            id: `consult-${c.id}`,
            type: 'approval',
            title: c.type === 'Forward' ? 'Forwarded for Input' : 'Consultation Response',
            description: c.type === 'Forward'
                ? `${c.from_name} forwarded this memo to ${c.to_name} for input.`
                : `${c.from_name} responded to ${c.to_name}'s request for input.`,
            timestamp: c.created_at,
            status: 'completed',
            user: c.from_name
        });
    });

    // 4. Distribution
    if (memo.status === 'Distributed') {
        events.push({
            id: 'distribution',
            type: 'distribution',
            title: 'Official Distribution',
            description: 'Memo has been cleared and broadcasted to all targets.',
            timestamp: memo.updated_at,
            status: 'completed'
        });
    }

    // 5. Acknowledgments
    // 5. Acknowledgments & Decisions
    recipients.filter(r => r.acknowledged_at).forEach((rec) => {
        const decisionText = rec.decision || 'Acknowledged';
        events.push({
            id: `ack-${rec.recipient_id}`,
            type: decisionText === 'Rejected' ? 'rejection' : 'acknowledgment',
            title: `Memo ${decisionText}`,
            description: `${rec.recipient_name} has received and ${decisionText.toLowerCase()} this communication.`,
            timestamp: rec.acknowledged_at,
            status: decisionText === 'Rejected' ? 'failed' : 'completed',
            user: rec.recipient_name
        });
    });

    // Sort events by timestamp or priority if null
    const sortedEvents = [...events].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
    });

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                    <h3 className="text-lg font-black text-[#1a365d] font-outfit uppercase tracking-tight">Audit Trail</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Reference {memo.reference_number}</p>
                </div>
            </div>

            <div className="space-y-1 relative ml-2">
                <div className="absolute top-2 bottom-2 left-[15px] w-0.5 bg-slate-100" />

                {sortedEvents.map((event, idx) => (
                    <div key={event.id} className="relative flex items-start gap-6 pb-6 group last:pb-0">
                        <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center z-10 border-2 border-white shadow-sm transition-all group-hover:scale-110",
                            event.status === 'completed' ? "bg-emerald-500 text-white" :
                                event.status === 'failed' ? "bg-red-500 text-white" :
                                    "bg-amber-100 text-amber-600 animate-pulse border-amber-50"
                        )}>
                            {event.type === 'creation' && <FilePlus size={14} />}
                            {(event.type === 'approval' || event.type === 'acknowledgment') && <CheckCircle2 size={14} />}
                            {event.type === 'rejection' && <XCircle size={14} />}
                            {event.type === 'distribution' && <Send size={14} />}
                        </div>

                        <div className="flex-grow space-y-0.5 pt-0.5">
                            <div className="flex items-center justify-between">
                                <h4 className={cn(
                                    "font-black text-xs uppercase tracking-wider",
                                    event.status === 'completed' ? "text-[#1a365d]" :
                                        event.status === 'failed' ? "text-red-700" :
                                            "text-amber-700"
                                )}>
                                    {event.title}
                                </h4>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {event.timestamp ? formatDate(event.timestamp) : 'Pending Action'}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-lg">
                                {event.description}
                            </p>
                            {event.user && (
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400">
                                        <User size={8} />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{event.user}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
