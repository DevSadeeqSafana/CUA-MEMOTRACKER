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
}

export default function MemoHistory({ memo, approvals, recipients }: MemoHistoryProps) {
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

    // 3. Distribution
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

    // 4. Acknowledgments
    recipients.filter(r => r.acknowledged_at).forEach((rec) => {
        events.push({
            id: `ack-${rec.recipient_id}`,
            type: 'acknowledgment',
            title: 'Memo Acknowledged',
            description: `${rec.recipient_name} has received and acknowledged this communication.`,
            timestamp: rec.acknowledged_at,
            status: 'completed',
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
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                <div>
                    <h3 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">Institutional Audit Trail</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Immutable lifecycle tracking for Reference {memo.reference_number}</p>
                </div>
            </div>

            <div className="space-y-1 relative ml-4">
                <div className="absolute top-2 bottom-2 left-[19px] w-0.5 bg-slate-100" />

                {sortedEvents.map((event, idx) => (
                    <div key={event.id} className="relative flex items-start gap-8 pb-10 group last:pb-0">
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center z-10 border-4 border-white shadow-sm transition-all group-hover:scale-110",
                            event.status === 'completed' ? "bg-emerald-500 text-white" :
                                event.status === 'failed' ? "bg-red-500 text-white" :
                                    "bg-amber-100 text-amber-600 animate-pulse border-amber-50"
                        )}>
                            {event.type === 'creation' && <FilePlus size={16} />}
                            {(event.type === 'approval' || event.type === 'acknowledgment') && <CheckCircle2 size={16} />}
                            {event.type === 'rejection' && <XCircle size={16} />}
                            {event.type === 'distribution' && <Send size={16} />}
                        </div>

                        <div className="flex-grow space-y-1 pt-1">
                            <div className="flex items-center justify-between">
                                <h4 className={cn(
                                    "font-black text-sm uppercase tracking-wider",
                                    event.status === 'completed' ? "text-[#1a365d]" :
                                        event.status === 'failed' ? "text-red-700" :
                                            "text-amber-700"
                                )}>
                                    {event.title}
                                </h4>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                    {event.timestamp ? formatDate(event.timestamp) : 'Pending Action'}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-lg">
                                {event.description}
                            </p>
                            {event.user && (
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                        <User size={10} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.user}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
