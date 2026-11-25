// Loads everything a memo's audit trail is built from. Shared by the memo page
// (audit trail modal) and the PDF export (audit table), so both show the same history.
import { query } from './db';
import { buildAuditEvents, type AuditEvent } from './audit-trail';

// DB rows are untyped mysql2 results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const PERSON = (alias: string, hs: string) =>
    `COALESCE(CONCAT(${hs}.FirstName, ' ', IFNULL(CONCAT(${hs}.MiddleName, ' '), ''), ${hs}.Surname), ${alias}.username)`;

export async function loadMemoAuditTrail(memoId: number): Promise<AuditEvent[]> {
    const memos = await query(
        `SELECT m.id, m.status, m.created_at, m.updated_at, ${PERSON('u', 'hs')} AS creator_name
         FROM memos m JOIN memo_system_users u ON u.id = m.created_by
         LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
         WHERE m.id = ?`,
        [memoId]
    ) as Row[];
    if (memos.length === 0) return [];
    const memo = memos[0];

    const [approvals, recipients, consultations, finance] = await Promise.all([
        query(
            `SELECT a.id, a.step_order, a.status, a.comments, a.processed_at, a.approver_id, ${PERSON('u', 'hs')} AS approver_name
             FROM memo_approvals a JOIN memo_system_users u ON u.id = a.approver_id
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE a.memo_id = ? ORDER BY a.step_order ASC`,
            [memoId]
        ) as Promise<Row[]>,
        query(
            `SELECT mr.recipient_id, mr.acknowledged_at, mr.decision, ${PERSON('u', 'hs')} AS recipient_name
             FROM memo_recipients mr JOIN memo_system_users u ON u.id = mr.recipient_id
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE mr.memo_id = ?`,
            [memoId]
        ) as Promise<Row[]>,
        query(
            `SELECT mc.id, mc.type, mc.created_at, ${PERSON('fu', 'fhs')} AS from_name, ${PERSON('tu', 'ths')} AS to_name
             FROM memo_consultations mc
             JOIN memo_system_users fu ON fu.id = mc.from_user_id LEFT JOIN hr_staff fhs ON fu.staff_id = fhs.StaffID
             JOIN memo_system_users tu ON tu.id = mc.to_user_id LEFT JOIN hr_staff ths ON tu.staff_id = ths.StaffID
             WHERE mc.memo_id = ? ORDER BY mc.created_at ASC`,
            [memoId]
        ).catch(() => []) as Promise<Row[]>,
        query(
            `SELECT fp.id, fp.created_at, ${PERSON('u', 'hs')} AS accountant_name
             FROM memo_finance_processing fp JOIN memo_system_users u ON u.id = fp.accountant_id
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE fp.memo_id = ? LIMIT 1`,
            [memoId]
        ).catch(() => []) as Promise<Row[]>,
    ]);
    const financeRecord = finance[0] || null;

    // Every audit log row that belongs to this memo, whatever table it was written against
    const logs = await query(
        `SELECT al.id, al.action, al.timestamp, CAST(al.new_value AS CHAR) AS new_value, ${PERSON('u', 'hs')} AS action_by_name
         FROM audit_logs al
         JOIN memo_system_users u ON al.user_id = u.id
         LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
         WHERE (al.table_name = 'memos' AND al.record_id = ?
                AND al.action IN ('ADJUST_ROUTING', 'SEND_TO_ACCOUNTANT', 'REVISE_MEMO', 'ADD_ATTACHMENT', 'DOWNLOAD_MEMO_PDF'))
            OR (al.table_name = 'memo_approvals' AND al.action = 'APPROVE_MEMO_TO_ACCOUNTANT'
                AND al.record_id IN (SELECT id FROM memo_approvals WHERE memo_id = ?))
            OR (al.table_name = 'memo_finance_processing' AND al.action = 'UPDATE_FINANCE_PROCESSING' AND al.record_id = ?)
            OR (al.table_name = 'memo_replies' AND al.action IN ('MEMO_REPLY', 'FORWARD_MEMO_REPLY')
                AND JSON_VALID(al.new_value) AND JSON_EXTRACT(al.new_value, '$.memoId') = ?)
         ORDER BY al.timestamp ASC, al.id ASC`,
        [memoId, memoId, financeRecord?.id ?? 0, memoId]
    ) as Row[];

    return buildAuditEvents({ memo, approvals, recipients, consultations, financeRecord, logs });
}
