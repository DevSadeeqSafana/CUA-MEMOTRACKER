// Builds a memo's audit trail (one chronological list of events) from its records.
// Pure: used by the audit trail modal on the memo page and the audit table in the PDF,
// so both always show the same history. Data loading lives in memo-audit.ts.
import { commentToPlainText } from './rich-text';

export type AuditEventType =
    | 'creation' | 'approval' | 'rejection' | 'distribution' | 'acknowledgment'
    | 'routing' | 'consultation' | 'reply' | 'finance' | 'revision' | 'attachment' | 'download';

export interface AuditEvent {
    id: string;
    type: AuditEventType;
    title: string;
    description: string;
    /** ISO time; null when the step has not happened yet (pending approval) */
    timestamp: string | null;
    status: 'completed' | 'pending' | 'failed';
    user?: string | null;
}

// DB rows are untyped mysql2 results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface AuditTrailInput {
    memo: Row;           // creator_name, created_at, updated_at, status
    approvals: Row[];    // id, step_order, status, comments, processed_at, approver_id, approver_name
    recipients: Row[];   // recipient_id, recipient_name, acknowledged_at, decision
    consultations: Row[]; // id, type, from_name, to_name, created_at
    financeRecord?: Row | null; // memo_finance_processing row + accountant_name
    /** audit_logs rows with action, timestamp, new_value, action_by_name */
    logs: Row[];
}

function parseLogValue(value: unknown): Row {
    if (!value) return {};
    if (typeof value === 'object') return value as Row;
    try { return JSON.parse(String(value)); } catch { return {}; }
}

const iso = (v: unknown): string | null => {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const list = (names: unknown) => (Array.isArray(names) ? names.filter(Boolean).join(', ') : '');

export function buildAuditEvents({ memo, approvals, recipients, consultations, financeRecord = null, logs }: AuditTrailInput): AuditEvent[] {
    const events: AuditEvent[] = [];
    const byAction = (...actions: string[]) => logs.filter(l => actions.includes(l.action));

    events.push({
        id: 'creation',
        type: 'creation',
        title: 'Memo Initiated',
        description: `Drafted and submitted by ${memo.creator_name}.`,
        timestamp: iso(memo.created_at),
        status: 'completed',
        user: memo.creator_name,
    });

    for (const log of byAction('ADJUST_ROUTING')) {
        const d = parseLogValue(log.new_value);
        const actor = log.action_by_name || 'A line manager';
        const parts: string[] = [];
        const oldR = String(d.oldRecipients || '').trim();
        const newR = String(d.newRecipients || '').trim();
        if (oldR && newR && oldR !== newR) parts.push(`${actor} changed the recipient from "${oldR}" to "${newR}".`);
        else if (String(d.addedRecipients || '').trim()) parts.push(`${actor} added "${String(d.addedRecipients).trim()}" as recipient(s).`);
        else if (String(d.removedRecipients || '').trim()) parts.push(`${actor} removed "${String(d.removedRecipients).trim()}" from the distribution.`);
        if (String(d.addedApprovers || '').trim()) parts.push(`${actor} added "${String(d.addedApprovers).trim()}" as an approver.`);
        events.push({
            id: `routing-${log.id}`,
            type: 'routing',
            title: 'Routing Adjusted',
            description: parts.length ? parts.join(' ') : `Routing was adjusted by ${actor}.`,
            timestamp: iso(log.timestamp),
            status: 'completed',
            user: log.action_by_name,
        });
    }

    for (const a of approvals) {
        const pending = a.status === 'Pending';
        events.push({
            id: `app-${a.id}`,
            type: a.status === 'Rejected' ? 'rejection' : 'approval',
            title: `Level ${a.step_order}: ${pending ? 'Review Required' : `Review ${a.status}`}`,
            description: pending
                ? `Awaiting decision from ${a.approver_name}.`
                : `${a.status} by ${a.approver_name}${a.comments ? `: ${commentToPlainText(a.comments)}` : '.'}`,
            timestamp: pending ? null : iso(a.processed_at),
            status: a.status === 'Approved' ? 'completed' : a.status === 'Rejected' ? 'failed' : 'pending',
            user: a.approver_name,
        });
    }

    for (const c of consultations) {
        const forward = c.type === 'Forward';
        events.push({
            id: `consult-${c.id}`,
            type: 'consultation',
            title: forward ? 'Forwarded for Input' : 'Consultation Response',
            description: forward
                ? `${c.from_name} forwarded this memo to ${c.to_name} for input.`
                : `${c.from_name} responded to ${c.to_name}'s request for input.`,
            timestamp: iso(c.created_at),
            status: 'completed',
            user: c.from_name,
        });
    }

    // Replies: recipients come from the log, which never records BCC names
    for (const log of byAction('MEMO_REPLY', 'FORWARD_MEMO_REPLY')) {
        const d = parseLogValue(log.new_value);
        const forward = log.action === 'FORWARD_MEMO_REPLY';
        const to = list(d.to);
        const cc = list(d.cc);
        const bcc = Number(d.bccCount) || 0;
        const who = [to && `to ${to}`, cc && `copying ${cc}`, bcc && `${bcc} hidden (Bcc) recipient${bcc === 1 ? '' : 's'}`].filter(Boolean).join(', ');
        events.push({
            id: `reply-${log.id}`,
            type: 'reply',
            title: forward ? 'Reply Forwarded' : 'Reply Sent',
            description: `${log.action_by_name} ${forward ? 'forwarded a reply' : 'replied'}${who ? ` ${who}` : ''}.`,
            timestamp: iso(log.timestamp),
            status: 'completed',
            user: log.action_by_name,
        });
    }

    if (memo.status === 'Distributed') {
        events.push({
            id: 'distribution',
            type: 'distribution',
            title: 'Official Distribution',
            description: 'Memo was cleared and sent to all recipients.',
            timestamp: iso(memo.updated_at),
            status: 'completed',
        });
    }

    // An approver's decision is already in the review chain; their recipient record
    // is acknowledged automatically, so it is skipped here.
    const approverIds = new Set(approvals.map(a => a.approver_id));
    for (const r of recipients) {
        if (!r.acknowledged_at || approverIds.has(r.recipient_id)) continue;
        const decision = r.decision || 'Acknowledged';
        events.push({
            id: `ack-${r.recipient_id}`,
            type: decision === 'Rejected' ? 'rejection' : 'acknowledgment',
            title: `Memo ${decision}`,
            description: `${r.recipient_name} received and ${String(decision).toLowerCase()} this memo.`,
            timestamp: iso(r.acknowledged_at),
            status: decision === 'Rejected' ? 'failed' : 'completed',
            user: r.recipient_name,
        });
    }

    if (financeRecord) {
        const sender = logs.find(l => l.action === 'SEND_TO_ACCOUNTANT' || l.action === 'APPROVE_MEMO_TO_ACCOUNTANT');
        events.push({
            id: 'finance-routed',
            type: 'finance',
            title: 'Sent to Accountant',
            description: sender
                ? `${sender.action_by_name} sent this memo to the Accountant (${financeRecord.accountant_name}) for processing.`
                : `Placed in the Accountant's finance queue (${financeRecord.accountant_name}) for processing.`,
            timestamp: iso(financeRecord.created_at),
            status: 'completed',
            user: sender?.action_by_name,
        });
    }

    for (const log of byAction('UPDATE_FINANCE_PROCESSING')) {
        const d = parseLogValue(log.new_value);
        const details = [d.voucherNumber ? `Payment voucher: ${d.voucherNumber}.` : '', d.notes ? `Notes: ${d.notes}` : ''].filter(Boolean).join(' ');
        events.push({
            id: `finance-${log.id}`,
            type: d.status === 'Rejected' ? 'rejection' : 'finance',
            title: `Finance Processing: ${d.status || 'Updated'}`,
            description: `${log.action_by_name} marked the finance processing as ${String(d.status || 'updated').toLowerCase()}.${details ? ` ${details}` : ''}`,
            timestamp: iso(log.timestamp),
            status: d.status === 'Rejected' ? 'failed' : 'completed',
            user: log.action_by_name,
        });
    }

    for (const log of byAction('REVISE_MEMO')) {
        const d = parseLogValue(log.new_value);
        const changes = [
            d.addedAttachments?.length ? `added ${d.addedAttachments.length} attachment(s)` : '',
            d.removedAttachments ? `removed ${d.removedAttachments} attachment(s)` : '',
        ].filter(Boolean).join(' and ');
        events.push({
            id: `revise-${log.id}`,
            type: 'revision',
            title: 'Memo Content Updated',
            description: `${log.action_by_name} updated the memo after input was requested${changes ? ` and ${changes}` : ''}.`,
            timestamp: iso(log.timestamp),
            status: 'completed',
            user: log.action_by_name,
        });
    }

    for (const log of byAction('ADD_ATTACHMENT')) {
        const d = parseLogValue(log.new_value);
        const count = d.addedAttachments?.length || 1;
        const names = d.addedAttachments?.map((a: Row) => a.name).filter(Boolean).join(', ');
        events.push({
            id: `attach-${log.id}`,
            type: 'attachment',
            title: 'Document Attached',
            description: `${log.action_by_name || 'A user'}${d.userRole ? ` (${d.userRole})` : ''} attached ${count} document(s)${names ? `: ${names}` : ''}${d.memoStatus ? ` (status: ${d.memoStatus})` : ''}${d.reason ? `. Note: "${d.reason}"` : ''}.`,
            timestamp: iso(log.timestamp),
            status: 'completed',
            user: log.action_by_name,
        });
    }

    for (const log of byAction('DOWNLOAD_MEMO_PDF')) {
        events.push({
            id: `pdf-${log.id}`,
            type: 'download',
            title: 'PDF Generated',
            description: `${log.action_by_name} downloaded a PDF copy of this memo.`,
            timestamp: iso(log.timestamp),
            status: 'completed',
            user: log.action_by_name,
        });
    }

    // Chronological; steps still pending go last
    const time = (e: AuditEvent) => (e.timestamp ? new Date(e.timestamp).getTime() : Number.MAX_SAFE_INTEGER);
    return events.sort((a, b) => time(a) - time(b));
}
