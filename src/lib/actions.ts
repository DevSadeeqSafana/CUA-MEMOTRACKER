'use server';

import { auth } from '@/auth';
import pool, { query } from './db';
import { UserFacingError, friendlyError, NOT_AUTHORIZED_MESSAGE } from './errors';
import { sendMemoNotificationEmail } from './mailer';
import { generateReferenceNumber } from './memo-utils';
import { sanitizeCommentHtml, isCommentEmpty } from './rich-text';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createUploadTicket } from './upload-ticket';
import { resolveVendorId } from './vendor-data';

// Attachment already stored by the backend upload endpoint (see client-upload.ts).
interface UploadedFile { url: string; name: string; size: number; type: string; }

function parseUploaded(raw: FormDataEntryValue | null): UploadedFile[] {
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list.filter(f => f && typeof f.url === 'string') : [];
    } catch { return []; }
}

// Applies attachment edits from a memo edit form: removes the attachments
// listed in `removed_attachment_ids`, then stores any new ones.
async function applyAttachmentChanges(memoId: number, uuid: string, data: FormData, userId?: number) {
    let removedIds: number[] = [];
    try {
        const parsed = JSON.parse((data.get('removed_attachment_ids') as string) || '[]');
        if (Array.isArray(parsed)) removedIds = parsed.map(Number).filter(Number.isInteger);
    } catch { /* ignore malformed input */ }

    for (const id of removedIds) {
        await query('DELETE FROM attachments WHERE id = ? AND memo_id = ?', [id, memoId]);
    }

    const added: string[] = [];
    for (const uploaded of parseUploaded(data.get('uploaded_attachments'))) {
        await query(
            'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
            [memoId, uploaded.name.substring(0, 255), uploaded.url.substring(0, 255), (uploaded.type || '').substring(0, 255), uploaded.size || 0, userId || null]
        );
        added.push(uploaded.name);
    }
    for (const file of data.getAll('attachments') as File[]) {
        if (!file || typeof file === 'string' || file.size === 0) continue;
        const filePath = await uploadFile(file, uuid);
        await query(
            'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
            [memoId, file.name.substring(0, 255), filePath.substring(0, 255), file.type.substring(0, 255), file.size, userId || null]
        );
        added.push(file.name);
    }

    return { removedCount: removedIds.length, added };
}

// Lets a signed-in user upload straight to the backend, so large files never
// pass through this (size-limited, diskless) server.
export async function getUploadTicket() {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: 'Unauthorized. Please log in again.' };
    if (!process.env.MEMO_UPLOAD_SECRET) return { success: false as const, error: 'Direct upload is not configured.' };
    return { success: true as const, token: createUploadTicket(session.user.id) };
}

async function getVCUserId() {
    try {
        const rows = await query(`
            SELECT u.id 
            FROM memo_system_users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'VC'
            LIMIT 1
        `) as any[];
        return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
        console.error('Failed to get VC user ID:', error);
        return null;
    }
}

async function getAccountantUserId() {
    try {
        const rows = await query(`
            SELECT u.id 
            FROM memo_system_users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'Accountant'
            LIMIT 1
        `) as any[];
        if (rows.length > 0) return rows[0].id;

        // Fallback specifically for Chidi Teddy Ojiako
        const chidiRows = await query(`
            SELECT id FROM memo_system_users
            WHERE email LIKE '%chidi.ojiako%' OR staff_id = 'E0152'
            LIMIT 1
        `) as any[];
        return chidiRows.length > 0 ? chidiRows[0].id : null;
    } catch (error) {
        console.error('Failed to get Accountant user ID:', error);
        return null;
    }
}

async function getUserFullName(userId: number | string) {
    const rows = await query(`
        SELECT COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
        FROM memo_system_users u
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE u.id = ?
    `, [userId]) as any[];
    return rows.length > 0 ? rows[0].full_name : 'An approver';
}

// Members of the approver group (VC, DVC, Registrar, COO, ...) may send any
// memo they approve straight to the Accountant. Returns false if the group
// table has not been migrated yet.
async function isApproverGroupMember(userId: number | string) {
    try {
        const rows = await query('SELECT 1 FROM memo_approver_group WHERE user_id = ? LIMIT 1', [userId]) as any[];
        return rows.length > 0;
    } catch (error) {
        console.error('Failed to check approver group membership:', error);
        return false;
    }
}

// Routes a memo an approver-group member explicitly sent to the Accountant,
// regardless of whether it looks like a finance memo.
async function sendMemoToAccountant(memoId: number, senderId: number | string) {
    const accountantId = await getAccountantUserId();
    if (!accountantId) throw new UserFacingError('No Accountant is configured to receive this memo.');

    const rows = await query(`
        SELECT m.title, COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as sender_name
        FROM memos m
        JOIN memo_system_users u ON u.id = ?
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE m.id = ?
    `, [senderId, memoId]) as any[];
    const { title, sender_name } = rows[0] || {};

    await query(`
        INSERT INTO memo_finance_processing (memo_id, accountant_id, status)
        VALUES (?, ?, 'Pending Processing')
        ON DUPLICATE KEY UPDATE accountant_id = VALUES(accountant_id)
    `, [memoId, accountantId]);

    await query(`
        INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type)
        VALUES (?, ?, 'To')
    `, [memoId, accountantId]);

    await query(`
        INSERT INTO notifications (user_id, memo_id, message)
        VALUES (?, ?, ?)
    `, [accountantId, memoId, `${sender_name} approved the memo "${title}" and sent it to you for processing.`]);
}

// An approver-group member who received a distributed memo (or approved it
// earlier in the chain) sends it to the Accountant after the fact.
export async function sendReceivedMemoToAccountant(memoId: number) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    try {
        if (!(await isApproverGroupMember(userId))) {
            return { success: false, error: 'You are not authorized to send memos to the Accountant.' };
        }

        const rows = await query(`
            SELECT m.uuid, m.status,
                   EXISTS (SELECT 1 FROM memo_recipients mr WHERE mr.memo_id = m.id AND mr.recipient_id = ?) as is_recipient,
                   EXISTS (SELECT 1 FROM memo_approvals a WHERE a.memo_id = m.id AND a.approver_id = ? AND a.status = 'Approved') as approved_it,
                   EXISTS (SELECT 1 FROM memo_finance_processing fp WHERE fp.memo_id = m.id) as in_queue
            FROM memos m WHERE m.id = ?
        `, [userId, userId, memoId]) as any[];
        const memo = rows[0];
        if (!memo || memo.status !== 'Distributed' || !(memo.is_recipient || memo.approved_it)) {
            return { success: false, error: 'This memo cannot be sent to the Accountant.' };
        }
        if (memo.in_queue) return { success: false, error: 'This memo is already in the Accountant\'s finance queue.' };
        if (!(await getAccountantUserId())) return { success: false, error: 'No Accountant is configured to receive this memo.' };

        await sendMemoToAccountant(memoId, userId);

        // Sending it on is an approval: record it on the recipient row too
        await query(
            `UPDATE memo_recipients
             SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                 acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
                 decision = 'Approved'
             WHERE memo_id = ? AND recipient_id = ?`,
            [memoId, userId]
        );

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, 'SEND_TO_ACCOUNTANT', 'memos', memoId, JSON.stringify({ via: memo.is_recipient ? 'recipient' : 'approver' })]
        );

        // A recipient's approval of a distributed memo is the final approval
        const approverName = await getUserFullName(userId);
        const creatorRows = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];
        await query(
            'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
            [creatorRows[0].created_by, memoId, `${approverName} gave final approval to your memo "${creatorRows[0].title}" and sent it to the Accountant for processing.`]
        );
        await sendMemoNotificationEmail(memoId, 'SENT_TO_ACCOUNTANT', { approverName, stage: 'final' });

        revalidatePath(`/dashboard/memos/${memo.uuid}`);
        revalidatePath('/dashboard/accountant');
        return { success: true };
    } catch (error: any) {
        console.error('sendReceivedMemoToAccountant error:', error);
        return { success: false, error: friendlyError(error, "We couldn't send this memo to the Accountant. Please try again.") };
    }
}

// Finance memos never reach the Accountant automatically. Only an approver-group
// member can send a memo there: "Approve & Send to Accountant" while approving
// (approveMemo), or "Send to Accountant" afterwards (sendReceivedMemoToAccountant).

export async function createMemo(data: FormData, isDraft: boolean) {
    console.log('--- Starting createMemo action ---');
    const session = await auth();
    if (!session?.user?.id) {
        console.error('createMemo: Unauthorized access attempt');
        return { success: false, error: 'Unauthorized. Please log in again.' };
    }

    const userId = parseInt(session.user.id);
    const title = data.get('title') as string;
    const content = data.get('content') as string;
    const department = data.get('department') as string;
    let category = data.get('category') as string;
    const custom_category = data.get('custom_category') as string;
    
    if (category === 'Others' && custom_category) {
        category = custom_category;
    }

    const priority = (data.get('priority') as string) || 'Medium';
    const memo_type = data.get('memo_type') as string;
    const expiry_date = data.get('expiry_date') as string;
    const is_budget_memo = data.get('is_budget_memo') === 'true';
    const year_id = data.get('year_id') as string;
    const budget_category = data.get('budget_category') as string;
    const other_category = data.get('other_category') as string;
    const budget_items_raw = data.get('budget_items') as string;
    const budget_items = budget_items_raw ? JSON.parse(budget_items_raw) : [];

    const recipient_ids = JSON.parse(data.get('recipient_ids') as string || '[]');
    const cc_ids = JSON.parse(data.get('cc_ids') as string || '[]');
    const bcc_ids = JSON.parse(data.get('bcc_ids') as string || '[]');
    const files = data.getAll('attachments') as File[];
    const uploadedFiles = parseUploaded(data.get('uploaded_attachments'));

    console.log(`createMemo: User ${userId} is creating a "${title}" memo (isDraft: ${isDraft})`);

    try {
        // A memo may name one registered vendor (shared Staff Portal vendor list)
        const vendorId = await resolveVendorId(data.get('vendor_id'));
        const referenceNumber = await generateReferenceNumber(department);
        const status = isDraft ? 'Draft' : 'Line Manager Review';
        const uuid = crypto.randomUUID();

        // 1. Insert Core Memo
        const result = await query(
            `INSERT INTO memos 
             (uuid, reference_number, title, content, department, category, priority, memo_type, status, expiry_date, created_by, vendor_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                referenceNumber,
                title,
                content,
                department,
                category,
                priority,
                memo_type,
                status,
                expiry_date || null,
                userId,
                vendorId
            ]
        ) as any;

        const memoId = result.insertId;
        console.log(`createMemo: Memo inserted with ID ${memoId}`);

        // 2. Handle Budget Info
        if (is_budget_memo) {
            const itemCategories = Array.from(new Set(budget_items.map((i: any) => i.budget_category).filter(Boolean)));
            const finalBudgetCategory = itemCategories.length > 0 ? itemCategories.join(', ') : budget_category;

            await query(
                `INSERT INTO memo_budget_info 
                 (memo_id, year_id, budget_category, other_category) 
                 VALUES (?, ?, ?, ?)`,
                [memoId, year_id, finalBudgetCategory, other_category]
            );

            for (let i = 0; i < budget_items.length; i++) {
                const item = budget_items[i];
                const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.amount) || 0);
                
                // Handle item-specific attachment
                let itemAttachmentPath = null;
                const itemUploaded = parseUploaded(data.get(`budget_item_upload_${i}`))[0];
                const itemFile = data.get(`budget_item_file_${i}`) as File;

                if (itemUploaded) {
                    itemAttachmentPath = itemUploaded.url;
                } else if (itemFile && itemFile.size > 0) {
                    itemAttachmentPath = await uploadFile(itemFile, uuid);
                }

                let finalDesc = item.description || '';
                if (item.budget_category && !finalDesc.startsWith(`[${item.budget_category}]`)) {
                    finalDesc = finalDesc ? `[${item.budget_category}] ${finalDesc}` : `[${item.budget_category}]`;
                }

                await query(
                    `INSERT INTO memo_budget_items 
                     (memo_id, name, description, quantity, amount, total, attachment_path) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [memoId, item.name, finalDesc, item.quantity || 1, item.amount || 0, subtotal, itemAttachmentPath]
                );
            }
        }

        // 3. Handle Attachments (General)
        for (const uploaded of uploadedFiles) {
            await query(
                'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
                [memoId, uploaded.name.substring(0, 255), uploaded.url.substring(0, 255), (uploaded.type || '').substring(0, 255), uploaded.size || 0, userId]
            );
        }
        if (files.length > 0) {
            for (const file of files) {
                if (!file || file.size === 0 || typeof file === 'string') continue;
                
                const filePath = await uploadFile(file, uuid);

                await query(
                    'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        memoId, 
                        (file as File).name.substring(0, 255), 
                        filePath.substring(0, 255), 
                        (file as File).type.substring(0, 255), 
                        (file as File).size,
                        userId
                    ]
                );
            }
        }

        // 4. Log the action
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, 'CREATE_MEMO', 'memos', memoId, JSON.stringify({ referenceNumber, status })]
        );

        // 5. Insert recipients (To, CC, BCC)
        const allRecipients = [
            ...recipient_ids.map((id: number) => ({ id, type: 'To' })),
            ...cc_ids.map((id: number) => ({ id, type: 'CC' })),
            ...bcc_ids.map((id: number) => ({ id, type: 'BCC' }))
        ];

        for (const recipient of allRecipients) {
            await query(
                'INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, ?)',
                [memoId, recipient.id, recipient.type]
            );
        }

        // 6. Setup sequential approvals
        if (!isDraft) {
            const userResult = await query('SELECT line_manager_id FROM memo_system_users WHERE id = ?', [userId]) as any[];
            const managerId = userResult.length > 0 ? userResult[0].line_manager_id : null;

            if (managerId) {
                await query(
                    'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                    [memoId, managerId, 1, 'Pending']
                );

                await query('UPDATE memos SET status = "Line Manager Review" WHERE id = ?', [memoId]);
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [managerId, memoId, `A new memo "${title}" requires your validation.`]
                );
                
                // Trigger email notification to the manager
                await sendMemoNotificationEmail(memoId, 'SUBMITTED');
            } else {
                await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);
                
                // Trigger email notifications to recipients & creator for automatic distribution
                await sendMemoNotificationEmail(memoId, 'DISTRIBUTED');
            }
        }

        console.log(`createMemo: Finished successfully for memo ${uuid}`);
        revalidatePath('/dashboard');
        return { success: true, memoId, memoUuid: uuid };
    } catch (error: any) {
        console.error('createMemo Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't save your memo. Please try again.") };
    }
}

export async function approveMemo(memoId: number, approvalId: number, comments: string = '', sendToAccountant: boolean = false) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    comments = isCommentEmpty(comments) ? '' : sanitizeCommentHtml(comments);

    try {
        if (sendToAccountant) {
            const ownStep = await query(
                'SELECT id FROM memo_approvals WHERE id = ? AND memo_id = ? AND approver_id = ? AND status = "Pending"',
                [approvalId, memoId, session.user.id]
            ) as any[];
            if (ownStep.length === 0 || !(await isApproverGroupMember(session.user.id!))) {
                return { success: false, error: 'You are not authorized to send memos to the Accountant.' };
            }
            if (!(await getAccountantUserId())) {
                return { success: false, error: 'No Accountant is configured to receive this memo.' };
            }
        }

        // Fetch step_order before modifying the record
        const approvedStep = await query('SELECT step_order FROM memo_approvals WHERE id = ?', [approvalId]) as any[];
        const stepOrder = approvedStep.length > 0 ? approvedStep[0].step_order : null;

        // Mark current step as approved with optional comments
        await query(
            'UPDATE memo_approvals SET status = "Approved", comments = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [comments, approvalId]
        );

        // An approver who is also on the distribution list has, by approving,
        // already seen the memo: record that so they are not asked to
        // acknowledge it again once it is distributed.
        await query(
            `UPDATE memo_recipients
             SET acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
                 decision = COALESCE(decision, 'Approved')
             WHERE memo_id = ? AND recipient_id = ?`,
            [memoId, session.user.id]
        );

        if (sendToAccountant) {
            await sendMemoToAccountant(memoId, session.user.id!);
            revalidatePath('/dashboard/accountant');
        }

        // Find the next sequential step
        const nextSteps = await query(
            'SELECT id, approver_id FROM memo_approvals WHERE memo_id = ? AND status = "Pending" ORDER BY step_order ASC LIMIT 1',
            [memoId]
        ) as any[];

        const memoInfo = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];
        const { created_by: creatorId, title: memoTitle } = memoInfo[0];

        if (nextSteps.length > 0) {
            // Move to next approver
            await query('UPDATE memos SET status = "Reviewer Approval" WHERE id = ?', [memoId]);

            const memoDetails = await query(`
                SELECT m.title, COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name
                FROM memos m
                JOIN memo_system_users u ON m.created_by = u.id
                LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                WHERE m.id = ?`, [memoId]) as any[];

            const message = `${memoDetails[0].creator_name}'s memo "${memoDetails[0].title}" has been reviewed. Your final decision is required.`;

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [nextSteps[0].approver_id, memoId, message]
            );

            // Tell the creator which approval this was. A Line Manager's
            // approval (step 1) only validates the submission.
            if (sendToAccountant) {
                const approverName = await getUserFullName(session.user.id!);
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [creatorId, memoId, `${approverName} approved your memo "${memoTitle}" and sent it to the Accountant for processing.`]
                );
                await sendMemoNotificationEmail(memoId, 'SENT_TO_ACCOUNTANT', { approverName, stage: 'approver' });
            } else if (stepOrder === 1) {
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [creatorId, memoId, `Your memo "${memoTitle}" has been validated by your Line Manager (not final approval) and is awaiting further approval.`]
                );
                await sendMemoNotificationEmail(memoId, 'APPROVED_BY_LM');
            }
        } else {
            // Last step complete: Distribute
            await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);
            const memo = [{ created_by: creatorId, title: memoTitle }];

            // Only the Line Manager in the chain means the memo was validated
            // and sent out, not given final approval
            const laterApprovals = await query(
                'SELECT COUNT(*) as n FROM memo_approvals WHERE memo_id = ? AND status = "Approved" AND step_order != 1',
                [memoId]
            ) as any[];
            const creatorMessage = Number(laterApprovals[0].n) > 0
                ? `Your memo "${memoTitle}" has received final approval and has been sent to its recipients.`
                : `Your memo "${memoTitle}" has been validated by your Line Manager (not final approval) and sent to its recipients.`;

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [creatorId, memoId, creatorMessage]
            );

            // Notify all recipients
            const recipients = await query('SELECT recipient_id FROM memo_recipients WHERE memo_id = ?', [memoId]) as any[];
            
            // --- VC Logic: Ensure VC has a copy at the end ---
            const vcId = await getVCUserId();
            if (vcId) {
                // Check if VC is already a recipient
                const isAlreadyRecipient = recipients.some((r: any) => r.recipient_id === vcId);
                if (!isAlreadyRecipient) {
                    await query(
                        'INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, ?)',
                        [memoId, vcId, 'To']
                    );
                    // Add VC to the list for notifications
                    recipients.push({ recipient_id: vcId });
                }
            }
            // ------------------------------------------------

            for (const recipient of recipients) {
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [recipient.recipient_id, memoId, `New internal memo: "${memo[0].title}" has been distributed.`]
                );
            }

            // Trigger email notification for distribution
            await sendMemoNotificationEmail(memoId, 'DISTRIBUTED');
        }

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, sendToAccountant ? 'APPROVE_MEMO_TO_ACCOUNTANT' : 'APPROVE_MEMO', 'memo_approvals', approvalId, JSON.stringify({ comments, sendToAccountant })]
        );

        revalidatePath(`/dashboard/memos/${memoId}`);
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/tasks');
        return { success: true };
    } catch (error: any) {
        console.error('Approval Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't record your decision. Please try again.") };
    }
}

export async function rejectMemo(memoId: number, approvalId: number, comments?: string) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    // A rejection must say why (rich text from CommentEditor, sanitised before saving)
    if (isCommentEmpty(comments)) {
        return { success: false, error: 'Please write the reason for rejecting this memo.' };
    }
    comments = sanitizeCommentHtml(comments!);

    try {
        // Only the approver of this pending step may reject it
        const ownStep = await query(
            'SELECT id FROM memo_approvals WHERE id = ? AND memo_id = ? AND approver_id = ? AND status = "Pending"',
            [approvalId, memoId, session.user.id]
        ) as any[];
        if (ownStep.length === 0) {
            return { success: false, error: 'This memo is no longer waiting for your decision. Refresh the page to see its current status.' };
        }

        await query(
            'UPDATE memo_approvals SET status = "Rejected", comments = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [comments, approvalId]
        );

        await query('UPDATE memos SET status = "Draft" WHERE id = ?', [memoId]);

        const memo = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];
        await query(
            'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
            [memo[0].created_by, memoId, `Your memo "${memo[0].title}" was rejected by the review committee.`]
        );

        // Trigger email notification for rejection
        await sendMemoNotificationEmail(memoId, 'REJECTED', { comments });

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, 'REJECT_MEMO', 'memo_approvals', approvalId, JSON.stringify({ comments })]
        );

        revalidatePath(`/dashboard/memos/${memoId}`);
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Rejection Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't record the rejection. Please try again.") };
    }
}

export async function markMemoAsRead(memoId: number) {
    const session = await auth();
    if (!session?.user) return;

    try {
        await query(
            'UPDATE memo_recipients SET read_at = CURRENT_TIMESTAMP WHERE memo_id = ? AND recipient_id = ? AND read_at IS NULL',
            [memoId, session.user.id]
        );
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}

// Recipients confirm receipt of a distributed memo. Approval decisions are
// made only by the approval chain (approveMemo / rejectMemo); a distributed
// memo is final, so there is nothing further for a recipient to approve.
export async function acknowledgeMemo(memoId: number) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        const decision = 'Acknowledged';
        await query(
            'UPDATE memo_recipients SET acknowledged_at = CURRENT_TIMESTAMP, decision = ? WHERE memo_id = ? AND recipient_id = ? AND acknowledged_at IS NULL',
            [decision, memoId, session.user.id]
        );

        // Always notify the sender when any recipient acts on it
        const memoRows = await query('SELECT created_by, title, uuid FROM memos WHERE id = ?', [memoId]) as any[];
        if (memoRows.length > 0) {
            const memo = memoRows[0];
            const actionText = 'acknowledged';
            
            // Fetch current user's full name
            const userRows = await query(`
                SELECT COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
                FROM memo_system_users u
                LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                WHERE u.id = ?
            `, [session.user.id]) as any[];
            const actorName = userRows.length > 0 ? userRows[0].full_name : session.user.name;

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [memo.created_by, memoId, `${actorName} has ${actionText} your memo "${memo.title}".`]
            );
        }

        revalidatePath(`/dashboard/memos/${memoId}`);
        return { success: true };
    } catch (error) {
        console.error('Acknowledgment error:', error);
        return { success: false };
    }
}

export async function createUser(formData: any) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        throw new Error('Unauthorized');
    }

    const { staff_id, username, email, password, department, roles, line_manager_id } = formData;
    const uuid = crypto.randomUUID();

    try {
        // --- Duplicate detection ---
        const existing = await query(
            `SELECT u.id, u.username, u.email, u.is_active, GROUP_CONCAT(r.name SEPARATOR ', ') as roles_list
             FROM memo_system_users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE u.staff_id = ? OR u.email = ?
             GROUP BY u.id
             LIMIT 1`,
            [staff_id, email]
        ) as any[];

        if (existing.length > 0) {
            const ex = existing[0];
            const status = ex.is_active ? 'Active' : 'Inactive';
            const existingRoles = ex.roles_list || 'No roles assigned';
            return {
                success: false,
                error: `This staff member already has an account. Status: ${status}. Current roles: ${existingRoles}. Use the Edit button on their existing profile to update their roles or status.`
            };
        }

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await query(
            'INSERT INTO memo_system_users (uuid, staff_id, username, email, password_hash, department, line_manager_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuid, staff_id, username, email, passwordHash, department, line_manager_id || null]
        ) as any;

        const userId = result.insertId;

        if (roles && roles.length > 0) {
            for (const roleName of roles) {
                const roleRows = await query('SELECT id FROM roles WHERE name = ?', [roleName]) as any[];
                if (roleRows.length > 0) {
                    await query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                        [userId, roleRows[0].id]
                    );
                }
            }
        }

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session.user.id, 'CREATE_USER', 'users', userId]
        );

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('Create user error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return { success: false, error: 'A user with this Staff ID or email already exists.' };
        }
        return { success: false, error: 'Failed to create user.' };
    }
}

export async function getManagers() {
    try {
        // Fetch users who have the Line Manager role OR are listed as managers in hr_staff
        const managers = await query(`
            SELECT DISTINCT u.id, 
                   COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as username, 
                   u.department, u.staff_id
            FROM memo_system_users u
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'Line Manager'
            OR u.staff_id IN (SELECT DISTINCT LineManagerID FROM hr_staff WHERE LineManagerID IS NOT NULL AND LineManagerID != '')
            LIMIT 50
        `) as any[];
        return managers;
    } catch (error) {
        console.error('Failed to fetch managers:', error);
        return [];
    }
}

export async function searchManagers(searchTerm: string) {
    const session = await auth();
    if (!session?.user) return [];

    try {
        // Search hr_staff for people who are managers (appear in LineManagerID of others)
        // AND check if they have a system account
        const results = await query(`
            SELECT 
                hr.StaffID, 
                hr.FirstName, 
                hr.Surname, 
                hr.DepartmentCode,
                u.id as system_user_id
            FROM hr_staff hr
            LEFT JOIN memo_system_users u ON hr.StaffID = u.staff_id
            WHERE (hr.FirstName LIKE ? OR hr.Surname LIKE ? OR hr.StaffID LIKE ?)
            AND hr.StaffID IN (SELECT DISTINCT LineManagerID FROM hr_staff WHERE LineManagerID IS NOT NULL AND LineManagerID != '')
            AND hr.IsActive = 1
            LIMIT 20
        `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]) as any[];

        return results.map(r => ({
            id: r.system_user_id, // If null, they don't have an account yet
            staff_id: r.StaffID,
            username: `${r.FirstName} ${r.Surname}`,
            department: r.DepartmentCode
        }));
    } catch (error) {
        console.error('Failed to search managers:', error);
        return [];
    }
}

export async function updateUser(userId: number, formData: any) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        throw new Error('Unauthorized');
    }

    const { username, email, department, roles, is_active, line_manager_id } = formData;

    try {
        await query(
            'UPDATE memo_system_users SET username = ?, email = ?, department = ?, is_active = ?, line_manager_id = ? WHERE id = ?',
            [username, email, department, is_active ?? true, line_manager_id || null, userId]
        );

        await query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

        if (roles && roles.length > 0) {
            for (const roleName of roles) {
                const roleRows = await query('SELECT id FROM roles WHERE name = ?', [roleName]) as any[];
                if (roleRows.length > 0) {
                    await query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                        [userId, roleRows[0].id]
                    );
                }
            }
        }

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session.user.id, 'UPDATE_USER', 'users', userId]
        );

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error('Update user error:', error);
        return { success: false, error: 'Failed to update user.' };
    }
}

export async function updateLineManager(userId: number, managerId: number | null) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    }

    try {
        await query(
            'UPDATE memo_system_users SET line_manager_id = ? WHERE id = ?',
            [managerId, userId]
        );
        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error('Update line manager error:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function deleteUser(userId: number) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        throw new Error('Unauthorized');
    }

    try {
        // Only block deletion if user has created memos or been an approver
        // (these are critical institutional records that cannot be orphaned)
        const createdMemos = await query('SELECT id FROM memos WHERE created_by = ? LIMIT 1', [userId]) as any[];
        const approvals = await query('SELECT id FROM memo_approvals WHERE approver_id = ? LIMIT 1', [userId]) as any[];

        if (createdMemos.length > 0 || approvals.length > 0) {
            return {
                success: false,
                error: 'This user has authored memos or signed approvals and cannot be removed. Use "Inactivate" to revoke access while preserving the institutional record.'
            };
        }

        // Reassign audit log entries from deleted user to the admin performing the deletion
        // (avoids NULL violation since user_id is NOT NULL in audit_logs FK)
        await query('UPDATE audit_logs SET user_id = ? WHERE user_id = ?', [session.user.id, userId]);

        // Remove relational data
        await query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        await query('DELETE FROM memo_recipients WHERE recipient_id = ?', [userId]);
        await query('DELETE FROM memo_system_users WHERE id = ?', [userId]);

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session.user.id, 'DELETE_USER', 'users', userId]
        );

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error('Delete user error:', error);
        return { success: false, error: 'Failed to delete user. They may still have linked records in the system.' };
    }
}

export async function resetUserPassword(userId: number) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    }

    try {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash('123456', salt);

        await query('UPDATE memo_system_users SET password_hash = ? WHERE id = ?', [newHash, userId]);

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session.user.id, 'RESET_PASSWORD', 'users', userId]
        );

        return { success: true };
    } catch (error: any) {
        console.error('Reset password error:', error);
        return { success: false, error: 'Failed to reset password.' };
    }
}

export async function toggleUserStatus(userId: number, currentStatus: boolean) {
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        throw new Error('Unauthorized');
    }

    try {
        await query('UPDATE memo_system_users SET is_active = ? WHERE id = ?', [!currentStatus, userId]);

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, 'TOGGLE_USER_STATUS', 'users', userId, JSON.stringify({ is_active: !currentStatus })]
        );

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Toggle status error:', error);
        return { success: false };
    }
}

export async function getDepartments() {
    try {
        const departments = await query(`
            SELECT DISTINCT DepartmentName as name 
            FROM hr_department 
            WHERE DepartmentName IS NOT NULL 
            ORDER BY DepartmentName ASC
        `) as any[];
        return departments;
    } catch (error) {
        console.error('Failed to fetch departments:', error);
        return [];
    }
}

export async function getCurrentFiscalYear() {
    try {
        const rows = await query(`
            SELECT EntryID as id, StartDate, EndDate
            FROM hr_finance_year
            WHERE CURRENT_DATE BETWEEN StartDate AND EndDate
            LIMIT 1
        `) as any[];
        if (rows.length > 0) {
            const y = rows[0];
            return {
                id: y.id.toString(),
                name: `${new Date(y.StartDate).getFullYear()} - ${new Date(y.EndDate).getFullYear()} Fiscal Year`
            };
        }
        // Fallback to latest
        const latest = await query(`
            SELECT EntryID as id, StartDate, EndDate
            FROM hr_finance_year
            ORDER BY StartDate DESC
            LIMIT 1
        `) as any[];
        if (latest.length > 0) {
            const y = latest[0];
            return {
                id: y.id.toString(),
                name: `${new Date(y.StartDate).getFullYear()} - ${new Date(y.EndDate).getFullYear()} Fiscal Year`
            };
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch current fiscal year:', error);
        return null;
    }
}

export async function getRecipients() {
    try {
        const { unstable_cache } = require('next/cache');
        const fetchRecipients = unstable_cache(
            async () => {
                const recipients = await query(`
                    SELECT u.id, 
                           COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as username, 
                           u.department 
                    FROM memo_system_users u
                    LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                    WHERE u.is_active = 1
                `) as any[];
                return recipients;
            },
            ['memo-recipients-list'],
            { revalidate: 300, tags: ['recipients'] }
        );
        return await fetchRecipients();
    } catch (error) {
        console.error('Failed to fetch recipients:', error);
        return [];
    }
}
export async function getNotifications() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const notifications = await query(`
            SELECT n.*, m.uuid as memo_uuid 
            FROM notifications n
            LEFT JOIN memos m ON n.memo_id = m.id
            WHERE n.user_id = ? 
            ORDER BY n.created_at DESC 
            LIMIT 20
        `, [session.user.id]) as any[];
        return notifications;
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }
}

export async function markNotificationAsRead(id: number) {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    try {
        await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, session.user.id]);
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return { success: false };
    }
}

export async function searchHRStaff(searchTerm: string) {
    const session = await auth();
    if (!session?.user) return [];

    try {
        const staff = await query(`
            SELECT StaffID, FirstName, MiddleName, Surname, OfficialEmailAddress, DepartmentCode, LineManagerID 
            FROM hr_staff 
            WHERE (FirstName LIKE ? OR Surname LIKE ? OR StaffID LIKE ? OR OfficialEmailAddress LIKE ?)
            AND IsActive = 1
            LIMIT 15
        `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]) as any[];
        return staff;
    } catch (error) {
        console.error('Failed to search HR staff:', error);
        return [];
    }
}

export async function changePassword(formData: { currentPassword: string; newPassword: string }) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const bcrypt = require('bcryptjs');

    const users = await query('SELECT password_hash FROM memo_system_users WHERE id = ?', [session.user.id]) as any[];
    if (users.length === 0) return { success: false, error: 'User not found.' };

    const passwordsMatch = await bcrypt.compare(formData.currentPassword, users[0].password_hash);
    if (!passwordsMatch) return { success: false, error: 'Your current password is incorrect.' };

    if (formData.newPassword.length < 8) {
        return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(formData.newPassword, salt);

    await query(
        'UPDATE memo_system_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newHash, session.user.id]
    );

    await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
        [session.user.id, 'CHANGE_PASSWORD', 'memo_system_users', session.user.id]
    );

    return { success: true };
}

export async function getBudgetItemsByListId(categoryNameOrId?: string | number) {
    try {
        if (!categoryNameOrId) {
            return [];
        }

        const isNumeric = !isNaN(Number(categoryNameOrId)) && String(categoryNameOrId).trim() !== '';
        let sql = '';
        let params: any[] = [];

        if (isNumeric) {
            sql = `
                SELECT i.EntryID as id, i.ItemName as category_name, i.ItemDescription as description, i.Amount as amount, i.Quantity as quantity
                FROM hr_finance_budget_item i
                JOIN hr_finance_budget_item_list l ON TRIM(LOWER(i.ItemName)) = TRIM(LOWER(l.ItemName))
                WHERE l.EntryID = ?
                ORDER BY i.EntryID ASC
            `;
            params = [Number(categoryNameOrId)];
        } else {
            sql = `
                SELECT i.EntryID as id, i.ItemName as category_name, i.ItemDescription as description, i.Amount as amount, i.Quantity as quantity
                FROM hr_finance_budget_item i
                WHERE TRIM(LOWER(i.ItemName)) = TRIM(LOWER(?))
                ORDER BY i.EntryID ASC
            `;
            params = [String(categoryNameOrId).trim()];
        }

        const items = await query(sql, params) as any[];

        return items.map((r: any) => {
            const rawDesc = (r.description || '').trim();
            let itemName = '';
            let itemDesc = rawDesc;

            if (rawDesc) {
                const productMatch = rawDesc.match(/^Product:\s*([^|]+)(?:\s*\|\s*(.*))?$/i);
                if (productMatch) {
                    itemName = productMatch[1].trim();
                    itemDesc = rawDesc;
                } else {
                    itemName = rawDesc;
                    itemDesc = rawDesc;
                }
            } else {
                itemName = r.category_name || '';
                itemDesc = '';
            }

            return {
                id: r.id,
                category: r.category_name,
                name: itemName,
                description: itemDesc,
                amount: Number(r.amount) || 0,
                quantity: Number(r.quantity) || 1,
            };
        });
    } catch (error) {
        console.error('Failed to fetch budget items by category:', error);
        return [];
    }
}

export async function getBudgetItemNames() {
    try {
        const { unstable_cache } = require('next/cache');
        const getNames = unstable_cache(
            async () => {
                const results = await query(`
                    SELECT ItemName, MAX(ItemDescription) as ItemDescription, MAX(Quantity) as Quantity, MAX(Amount) as Amount
                    FROM hr_finance_budget_item 
                    WHERE ItemName IS NOT NULL AND ItemName != ''
                    GROUP BY ItemName
                    ORDER BY ItemName ASC
                `) as any[];
                return results.map(r => ({
                    name: r.ItemName,
                    description: r.ItemDescription || '',
                    quantity: Number(r.Quantity) || 1,
                    amount: Number(r.Amount) || 0
                }));
            },
            ['budget-item-names-db'],
            { revalidate: 3600, tags: ['budget-data'] }
        );
        return await getNames();
    } catch (error) {
        console.error('Failed to fetch budget item names:', error);
        return [];
    }
}

export async function getBudgetItems(searchTerm: string, yearId?: string) {
    const session = await auth();
    if (!session?.user) return [];

    try {
        let sql = `
            SELECT i.EntryID as id, i.ItemName as name, i.ItemDescription as description, i.Amount as amount, i.Total as total,
                   b.EntryID as budget_ref, b.YearID as year_id
            FROM hr_finance_budget_item i
            JOIN hr_finance_budget b ON i.BudgetID = b.EntryID
            WHERE (i.ItemName LIKE ? OR i.ItemDescription LIKE ?)
        `;
        const params: any[] = [`%${searchTerm}%`, `%${searchTerm}%`];

        if (yearId) {
            sql += ` AND b.YearID = ?`;
            params.push(yearId);
        }

        sql += ` LIMIT 20`;

        const items = await query(sql, params) as any[];
        return items;
    } catch (error) {
        console.error('Failed to fetch budget items:', error);
        return [];
    }
}

export async function getBudgetAccounts() {
    try {
        const accounts = await query(`
            SELECT DISTINCT AccountName as name, Category as category
            FROM hr_finance_account
            LIMIT 100
        `) as any[];
        return accounts;
    } catch (error) {
        console.error('Failed to fetch budget accounts:', error);
        return [];
    }
}

export async function getBudgetItemLists() {
    try {
        const { unstable_cache } = require('next/cache');
        const fetchLists = unstable_cache(
            async () => {
                const items = await query(`
                    SELECT EntryID as id, ItemName as name
                    FROM hr_finance_budget_item_list
                    ORDER BY ItemName ASC
                `) as any[];
                return items;
            },
            ['budget-category-list'],
            { revalidate: 3600, tags: ['budget-data'] }
        );
        return await fetchLists();
    } catch (error) {
        console.error('Failed to fetch budget item list:', error);
        return [];
    }
}
export async function getBudgetYears() {
    try {
        const { unstable_cache } = require('next/cache');
        const fetchYears = unstable_cache(
            async () => {
                const years = await query(`
                    SELECT EntryID as id, StartDate, EndDate
                    FROM hr_finance_year
                    ORDER BY StartDate DESC
                `) as any[];

                return years.map(y => ({
                    id: y.id,
                    name: `${new Date(y.StartDate).toLocaleDateString()} - ${new Date(y.EndDate).toLocaleDateString()}`
                }));
            },
            ['budget-finance-years'],
            { revalidate: 3600, tags: ['budget-data'] }
        );
        return await fetchYears();
    } catch (error) {
        console.error('Failed to fetch budget years:', error);
        return [];
    }
}
export async function updateMemoRouting(
    memoId: number,
    recipientIds: number[],
    additionalApprovers: { id: number; name: string }[]
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    const userId = parseInt(session.user.id);

    // Clean the inputs: unique positive integer ids only
    const uniqueIds = (ids: unknown[]) =>
        Array.from(new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0)));
    const newRecipientIds = uniqueIds(recipientIds || []);
    const approverIds = uniqueIds((additionalApprovers || []).map(a => a?.id));

    if (newRecipientIds.length === 0) {
        return { success: false, error: 'Select at least one final recipient.' };
    }

    // All changes are applied together or not at all
    const connection = await pool.getConnection();
    let memoUuid: string | null = null;
    let notification: { creatorId: number; message: string } | null = null;

    try {
        await connection.beginTransaction();

        const [memoRows] = await connection.execute(
            'SELECT id, uuid, title, created_by FROM memos WHERE id = ? FOR UPDATE',
            [memoId]
        ) as any[];
        const memo = memoRows[0];
        if (!memo) throw new UserFacingError('Memo not found.');
        memoUuid = memo.uuid;

        // Verify the user is the current pending approver for this memo
        const [pendingApprovals] = await connection.execute(
            'SELECT id, step_order FROM memo_approvals WHERE memo_id = ? AND approver_id = ? AND status = "Pending"',
            [memoId, userId]
        ) as any[];
        if (pendingApprovals.length === 0) {
            throw new UserFacingError('Only the current pending approver can modify routing.');
        }

        // Approvers being added must be active users, not the creator, not you,
        // and not already waiting in this memo's approval chain
        if (approverIds.length > 0) {
            const placeholders = approverIds.map(() => '?').join(',');
            const [activeRows] = await connection.execute(
                `SELECT id FROM memo_system_users WHERE is_active = 1 AND id IN (${placeholders})`,
                approverIds
            ) as any[];
            if (activeRows.length !== approverIds.length) throw new UserFacingError('One of the selected approvers is not an active user.');
            if (approverIds.includes(memo.created_by)) throw new UserFacingError('The memo creator cannot be added as an approver.');
            if (approverIds.includes(userId)) throw new UserFacingError('You are already approving this memo.');
            const [alreadyPending] = await connection.execute(
                `SELECT approver_id FROM memo_approvals WHERE memo_id = ? AND status = 'Pending' AND approver_id IN (${placeholders})`,
                [memoId, ...approverIds]
            ) as any[];
            if (alreadyPending.length > 0) throw new UserFacingError('One of the selected approvers is already in the approval chain.');
        }

        const fullName = async (id: number) => {
            const [rows] = await connection.execute(`
                SELECT COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
                FROM memo_system_users u
                LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
                WHERE u.id = ?`, [id]) as any[];
            return rows.length > 0 ? String(rows[0].full_name) : '';
        };

        // 1. Recipients: remove the ones dropped, add the new ones.
        //    Recipients who stay keep their To/CC/BCC type and read/acknowledged status.
        const [currentRows] = await connection.execute(
            'SELECT recipient_id FROM memo_recipients WHERE memo_id = ?',
            [memoId]
        ) as any[];
        const currentIds: number[] = currentRows.map((r: any) => Number(r.recipient_id));
        const removedIds = currentIds.filter(id => !newRecipientIds.includes(id));
        const addedIds = newRecipientIds.filter(id => !currentIds.includes(id));

        const oldRecipientNames: string[] = [];
        for (const id of currentIds) oldRecipientNames.push(await fullName(id));
        const newRecipientNames: string[] = [];
        for (const id of newRecipientIds) newRecipientNames.push(await fullName(id));

        if (removedIds.length > 0) {
            await connection.execute(
                `DELETE FROM memo_recipients WHERE memo_id = ? AND recipient_id IN (${removedIds.map(() => '?').join(',')})`,
                [memoId, ...removedIds]
            );
        }
        for (const rid of addedIds) {
            await connection.execute(
                'INSERT INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, ?)',
                [memoId, rid, 'To']
            );
        }

        const addedRecipients = (await Promise.all(addedIds.map(fullName))).join(', ');
        const removedRecipients = (await Promise.all(removedIds.map(fullName))).join(', ');

        // 2. Insert the additional approvers right after the current step
        let nextStepOrder = Number(pendingApprovals[0].step_order) + 1;
        if (approverIds.length > 0) {
            await connection.execute(
                'UPDATE memo_approvals SET step_order = step_order + ? WHERE memo_id = ? AND step_order >= ?',
                [approverIds.length, memoId, nextStepOrder]
            );
            for (const approverId of approverIds) {
                await connection.execute(
                    'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                    [memoId, approverId, nextStepOrder++, 'Pending']
                );
            }
        }
        const approverNames = (await Promise.all(approverIds.map(fullName))).join(', ');

        const oldRecipientNamesString = oldRecipientNames.join(', ');
        const newRecipientNamesString = newRecipientNames.join(', ');

        // Log the action with rich details
        await connection.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [
                userId,
                'ADJUST_ROUTING',
                'memos',
                memoId,
                JSON.stringify({
                    addedRecipients,
                    removedRecipients,
                    addedApprovers: approverNames,
                    oldRecipients: oldRecipientNamesString,
                    newRecipients: newRecipientNamesString
                })
            ]
        );

        // Notification for the creator
        const actorName = (await fullName(userId)) || session.user.name || 'An approver';
        let message = `${actorName} has adjusted the routing for your memo "${memo.title}".`;
        if (oldRecipientNamesString && newRecipientNamesString && oldRecipientNamesString !== newRecipientNamesString) {
            message += ` Recipient changed from ${oldRecipientNamesString} to ${newRecipientNamesString}.`;
        } else if (addedRecipients) {
            message += ` Added recipients: ${addedRecipients}.`;
        }
        if (approverNames) {
            message += ` Added ${approverNames} as ${approverIds.length === 1 ? 'an approver' : 'approvers'}.`;
        }
        await connection.execute(
            'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
            [memo.created_by, memoId, message]
        );
        notification = { creatorId: memo.created_by, message };

        await connection.commit();
    } catch (error: any) {
        await connection.rollback().catch(() => {});
        console.error('Update Routing Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't update the routing. Please try again.") };
    } finally {
        connection.release();
    }

    if (memoUuid) revalidatePath(`/dashboard/memos/${memoUuid}`);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/tasks');

    return { success: true, notified: Boolean(notification) };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMO CONSULTATION / FORWARDING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forward a memo to someone for consultation/input.
 * parentId = null means it's a fresh forward from an approver.
 * parentId = <id> means it's a response or sub-forward in an existing thread.
 */
export async function forwardMemoConsultation(
    memoId: number,
    toUserId: number,
    message: string,
    parentId: number | null = null
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const fromUserId = parseInt(session.user.id);

    // Rich-text message: keep only the formatting the comment editor produces
    if (isCommentEmpty(message)) return { success: false, error: 'Write a message before sending.' };
    message = sanitizeCommentHtml(message);
    if (message.length > 20000) return { success: false, error: 'This message is too long.' };

    try {
        const result = await query(
            `INSERT INTO memo_consultations (memo_id, from_user_id, to_user_id, message, parent_id, type)
             VALUES (?, ?, ?, ?, ?, 'Forward')`,
            [memoId, fromUserId, toUserId, message, parentId]
        ) as any;

        const consultationId = result.insertId;

        // Fetch memo title and sender name for notifications
        const memoRows = await query(
            `SELECT m.title, m.uuid, 
                    COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as sender_name 
             FROM memos m 
             JOIN memo_system_users u ON m.created_by = u.id 
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE m.id = ?`,
            [memoId]
        ) as any[];

        if (memoRows.length > 0) {
            const { title, sender_name } = memoRows[0];
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [
                    toUserId,
                    memoId,
                    `${session.user.name} has forwarded the memo "${title}" to you for your input. Please review and respond.`
                ]
            );
        }

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [fromUserId, 'FORWARD_CONSULTATION', 'memo_consultations', consultationId,
                JSON.stringify({ toUserId, parentId, preview: message.substring(0, 100) })]
        );

        revalidatePath(`/dashboard/memos/${memoId}`);
        return { success: true, consultationId };
    } catch (error: any) {
        console.error('Forward consultation error:', error);
        return { success: false, error: friendlyError(error, "We couldn't forward the memo. Please try again.") };
    }
}

/**
 * Respond to a consultation thread entry.
 * Creates a 'Response' node linked back to the parent forward.
 */
export async function respondToConsultation(
    memoId: number,
    parentId: number,
    toUserId: number,
    message: string
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const fromUserId = parseInt(session.user.id);

    // Rich-text message: keep only the formatting the comment editor produces
    if (isCommentEmpty(message)) return { success: false, error: 'Write a message before sending.' };
    message = sanitizeCommentHtml(message);
    if (message.length > 20000) return { success: false, error: 'This message is too long.' };

    try {
        const result = await query(
            `INSERT INTO memo_consultations (memo_id, from_user_id, to_user_id, message, parent_id, type)
             VALUES (?, ?, ?, ?, ?, 'Response')`,
            [memoId, fromUserId, toUserId, message, parentId]
        ) as any;

        const memoRows = await query('SELECT title FROM memos WHERE id = ?', [memoId]) as any[];
        if (memoRows.length > 0) {
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [
                    toUserId,
                    memoId,
                    `${session.user.name} has responded to your consultation request on memo "${memoRows[0].title}".`
                ]
            );
        }

        revalidatePath(`/dashboard/memos/${memoId}`);
        return { success: true, consultationId: result.insertId };
    } catch (error: any) {
        console.error('Respond to consultation error:', error);
        return { success: false, error: friendlyError(error, "We couldn't send your response. Please try again.") };
    }
}

/**
 * Fetch all consultation threads for a memo, with sender/recipient names.
 */
export async function getConsultations(memoId: number) {
    try {
        const rows = await query(
            `SELECT 
                mc.*,
                COALESCE(CONCAT(fhs.FirstName, ' ', IFNULL(CONCAT(fhs.MiddleName, ' '), ''), fhs.Surname), fu.username) as from_name,
                COALESCE(CONCAT(ths.FirstName, ' ', IFNULL(CONCAT(ths.MiddleName, ' '), ''), ths.Surname), tu.username) as to_name
             FROM memo_consultations mc
             JOIN memo_system_users fu ON mc.from_user_id = fu.id
             LEFT JOIN hr_staff fhs ON fu.staff_id = fhs.StaffID
             JOIN memo_system_users tu ON mc.to_user_id = tu.id
             LEFT JOIN hr_staff ths ON tu.staff_id = ths.StaffID
             WHERE mc.memo_id = ?
             ORDER BY mc.created_at ASC`,
            [memoId]
        ) as any[];
        return rows;
    } catch (error: any) {
        console.error('Get consultations error:', error);
        return [];
    }
}

// ─── MEMO REPLIES ────────────────────────────────────────────────────────────
// Email-style replies on a memo. Anyone taking part in the memo (creator, approvers,
// recipients, people it was forwarded to, people in a reply) can reply. A reply has
// its own To / CC / BCC list: To defaults to the memo's sender but can be changed to
// anyone, and more people can be added. A reply may answer an earlier reply
// (parent_id), so replies form threads. Recipients of a reply become participants
// of the memo, so they can reply again or forward the memo onward.
// A reply is visible to its author and its recipients; BCC recipients are visible
// only to the author and to themselves.

const MAX_REPLY_HTML_LENGTH = 20000;
const MAX_REPLY_RECIPIENTS = 50;

export type ReplyRecipientType = 'To' | 'CC' | 'BCC';

export interface MemoReplyRecipient {
    user_id: number;
    name: string;
    department: string | null;
    type: ReplyRecipientType;
}

export interface MemoReplyMessage {
    id: number;
    parent_id: number | null;
    author_id: number;
    author_name: string;
    message: string;
    created_at: string;
    recipients: MemoReplyRecipient[];
    /** true when the viewer received this reply and has not opened the memo since */
    unread: boolean;
}

export interface PostMemoReplyInput {
    to: number[];
    cc?: number[];
    bcc?: number[];
    message: string;
    /** the reply being answered or forwarded; omit to reply to the memo itself */
    parentId?: number | null;
    /** 'forward' only changes the wording of notifications and the audit log */
    mode?: 'reply' | 'forward';
}

/** Is the user part of this memo's workflow (and therefore allowed to reply)? */
async function isMemoParticipant(memoId: number, userId: number) {
    const rows = await query(`
        SELECT
            (m.created_by = ?)
            OR EXISTS (SELECT 1 FROM memo_approvals a WHERE a.memo_id = m.id AND a.approver_id = ?)
            OR EXISTS (SELECT 1 FROM memo_recipients r WHERE r.memo_id = m.id AND r.recipient_id = ?)
            OR EXISTS (SELECT 1 FROM memo_consultations c WHERE c.memo_id = m.id AND (c.from_user_id = ? OR c.to_user_id = ?))
            OR EXISTS (SELECT 1 FROM memo_replies mr
                       LEFT JOIN memo_reply_recipients rr ON rr.reply_id = mr.id AND rr.user_id = ?
                       WHERE mr.memo_id = m.id AND (mr.author_id = ? OR rr.user_id IS NOT NULL)) AS participant
        FROM memos m WHERE m.id = ?
    `, [userId, userId, userId, userId, userId, userId, userId, memoId]) as any[];
    return Boolean(rows[0]?.participant);
}

/** Has the user received (or written) any reply on this memo? Used by the memo page. */
export async function isMemoReplyParticipant(memoId: number) {
    const session = await auth();
    if (!session?.user?.id) return false;
    const userId = parseInt(session.user.id);
    try {
        const rows = await query(`
            SELECT 1 FROM memo_replies mr
            LEFT JOIN memo_reply_recipients rr ON rr.reply_id = mr.id AND rr.user_id = ?
            WHERE mr.memo_id = ? AND (mr.author_id = ? OR rr.user_id IS NOT NULL)
            LIMIT 1
        `, [userId, memoId, userId]) as any[];
        return rows.length > 0;
    } catch {
        return false;
    }
}

/** Replies on a memo that the signed-in user may see, oldest first. */
export async function getMemoReplies(memoId: number): Promise<MemoReplyMessage[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    const userId = parseInt(session.user.id);
    try {
        const replies = await query(`
            SELECT mr.id, mr.parent_id, mr.author_id, mr.message, mr.created_at,
                   COALESCE(CONCAT(ahs.FirstName, ' ', IFNULL(CONCAT(ahs.MiddleName, ' '), ''), ahs.Surname), au.username) AS author_name,
                   me.user_id IS NOT NULL AND me.read_at IS NULL AS unread
            FROM memo_replies mr
            JOIN memo_system_users au ON au.id = mr.author_id
            LEFT JOIN hr_staff ahs ON au.staff_id = ahs.StaffID
            LEFT JOIN memo_reply_recipients me ON me.reply_id = mr.id AND me.user_id = ?
            WHERE mr.memo_id = ? AND (mr.author_id = ? OR me.user_id IS NOT NULL)
            ORDER BY mr.created_at ASC, mr.id ASC
        `, [userId, memoId, userId]) as any[];
        if (replies.length === 0) return [];

        const ids = replies.map(r => r.id);
        const recipients = await query(`
            SELECT rr.reply_id, rr.user_id, rr.recipient_type,
                   COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) AS name,
                   u.department
            FROM memo_reply_recipients rr
            JOIN memo_system_users u ON u.id = rr.user_id
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            WHERE rr.reply_id IN (${ids.map(() => '?').join(',')})
            ORDER BY FIELD(rr.recipient_type, 'To', 'CC', 'BCC'), name ASC
        `, ids) as any[];

        return replies.map(r => ({
            id: r.id,
            parent_id: r.parent_id ?? null,
            author_id: r.author_id,
            author_name: r.author_name,
            message: r.message,
            created_at: new Date(r.created_at).toISOString(),
            unread: Boolean(r.unread),
            recipients: recipients
                .filter(x => x.reply_id === r.id)
                // BCC stays hidden from everyone except the author and the BCC'd person
                .filter(x => x.recipient_type !== 'BCC' || r.author_id === userId || x.user_id === userId)
                .map(x => ({ user_id: x.user_id, name: x.name, department: x.department, type: x.recipient_type })),
        }));
    } catch (error: any) {
        // Tables not migrated yet: behave as "no replies" instead of breaking the memo page
        if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.code !== 'ER_BAD_FIELD_ERROR') console.error('getMemoReplies error:', error);
        return [];
    }
}

/** Marks the replies the signed-in user received on this memo as read. */
export async function markMemoRepliesRead(memoId: number) {
    const session = await auth();
    if (!session?.user?.id) return;
    try {
        await query(`
            UPDATE memo_reply_recipients rr JOIN memo_replies mr ON mr.id = rr.reply_id
            SET rr.read_at = CURRENT_TIMESTAMP
            WHERE mr.memo_id = ? AND rr.user_id = ? AND rr.read_at IS NULL
        `, [memoId, parseInt(session.user.id)]);
    } catch (error: any) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') console.error('markMemoRepliesRead error:', error);
    }
}

/** Send a reply (or forward a reply) with its own To / CC / BCC recipients. */
export async function postMemoReply(memoId: number, input: PostMemoReplyInput) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    const message = input?.message ?? '';
    const html = isCommentEmpty(message) ? '' : sanitizeCommentHtml(message);
    if (!html) return { success: false, error: 'Write a reply before sending.' };
    if (html.length > MAX_REPLY_HTML_LENGTH) return { success: false, error: 'This reply is too long.' };

    // One entry per person: To wins over CC, CC over BCC. You never send to yourself.
    const ids = (list: unknown) => Array.isArray(list) ? list.map(Number).filter(n => Number.isInteger(n) && n > 0 && n !== userId) : [];
    const typeByUser = new Map<number, ReplyRecipientType>();
    for (const [type, list] of [['To', input.to], ['CC', input.cc], ['BCC', input.bcc]] as const) {
        for (const id of ids(list)) if (!typeByUser.has(id)) typeByUser.set(id, type);
    }
    if (![...typeByUser.values()].includes('To')) return { success: false, error: 'Add at least one person in the "To" field.' };
    if (typeByUser.size > MAX_REPLY_RECIPIENTS) return { success: false, error: `A reply can go to at most ${MAX_REPLY_RECIPIENTS} people.` };

    const mode = input.mode === 'forward' ? 'forward' : 'reply';
    const parentId = input.parentId ? Number(input.parentId) : null;

    try {
        const memoRows = await query('SELECT id, uuid, title, status FROM memos WHERE id = ?', [memoId]) as any[];
        const memo = memoRows[0];
        if (!memo) return { success: false, error: 'Memo not found.' };
        if (memo.status === 'Draft') return { success: false, error: 'You can reply once the memo has been submitted.' };

        if (!(await isMemoParticipant(memoId, userId))) {
            return { success: false, error: 'Only people involved in this memo can reply to it.' };
        }

        if (parentId !== null) {
            // The reply being answered must be on this memo and visible to the user
            const parent = await query(`
                SELECT 1 FROM memo_replies mr
                LEFT JOIN memo_reply_recipients rr ON rr.reply_id = mr.id AND rr.user_id = ?
                WHERE mr.id = ? AND mr.memo_id = ? AND (mr.author_id = ? OR rr.user_id IS NOT NULL)
            `, [userId, parentId, memoId, userId]) as any[];
            if (parent.length === 0) return { success: false, error: 'The message you are replying to was not found.' };
        }

        const recipientIds = [...typeByUser.keys()];
        const users = await query(`
            SELECT u.id, COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) AS name
            FROM memo_system_users u LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            WHERE u.is_active = 1 AND u.id IN (${recipientIds.map(() => '?').join(',')})
        `, recipientIds) as any[];
        if (users.length !== recipientIds.length) return { success: false, error: 'One of the recipients is not an active user. Remove them and try again.' };
        const nameById = new Map<number, string>(users.map(u => [u.id, u.name]));

        const connection = await pool.getConnection();
        let replyId: number;
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'INSERT INTO memo_replies (memo_id, parent_id, author_id, message) VALUES (?, ?, ?, ?)',
                [memoId, parentId, userId, html]
            ) as any;
            replyId = result.insertId;
            for (const [id, type] of typeByUser) {
                await connection.execute(
                    'INSERT INTO memo_reply_recipients (reply_id, user_id, recipient_type) VALUES (?, ?, ?)',
                    [replyId, id, type]
                );
            }
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }

        const authorName = await getUserFullName(userId);
        const verb = mode === 'forward' ? 'forwarded a reply on' : 'replied on';
        for (const id of recipientIds) {
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [id, memoId, `${authorName} ${verb} the memo "${memo.title}" and included you.`]
            );
        }

        const namesOf = (type: ReplyRecipientType) => recipientIds.filter(id => typeByUser.get(id) === type).map(id => nameById.get(id));
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, mode === 'forward' ? 'FORWARD_MEMO_REPLY' : 'MEMO_REPLY', 'memo_replies', replyId,
                // BCC names are left out of the audit trail on purpose; only the count is kept
                JSON.stringify({ memoId, parentId, to: namesOf('To'), cc: namesOf('CC'), bccCount: namesOf('BCC').length })]
        );

        revalidatePath(`/dashboard/memos/${memo.uuid}`);
        revalidatePath('/dashboard/tasks');
        return { success: true, replyId };
    } catch (error: any) {
        console.error('postMemoReply error:', error);
        if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') {
            return { success: false, error: 'Replies are not enabled yet. Ask the administrator to run the latest migration.' };
        }
        return { success: false, error: friendlyError(error, "We couldn't send the reply. Please try again.") };
    }
}

/**
 * Search all active users (for the forward-to selector).
 */
export async function searchUsersForConsultation(searchTerm: string) {
    const session = await auth();
    if (!session?.user?.id) return [];
    const currentUserId = parseInt(session.user.id);

    try {
        const users = await query(
            `SELECT u.id, 
                    COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as username, 
                    u.department 
             FROM memo_system_users u
             LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
             WHERE u.is_active = 1 AND u.id != ? AND (u.username LIKE ? OR u.department LIKE ? OR hs.FirstName LIKE ? OR hs.Surname LIKE ?)
             LIMIT 20`,
            [currentUserId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        ) as any[];
        return users;
    } catch (error: any) {
        console.error('Search users for consultation error:', error);
        return [];
    }
}

async function uploadFile(file: File, uuid: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadApiUrl = process.env.UPLOAD_API_URL || process.env.NEXT_PUBLIC_UPLOAD_API_URL;
    const uploadSecretToken = process.env.UPLOAD_SECRET_TOKEN || process.env.MEMO_UPLOAD_SECRET;

    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

    let filePath = '';

    // Try remote upload
    if (uploadApiUrl && uploadSecretToken) {
        try {
            const formData = new FormData();
            formData.append('file', file as File);

            const response = await fetch(uploadApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${uploadSecretToken}`
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.file && result.file.url) {
                    filePath = result.file.url;
                }
            } else {
                console.error(`Upload failed for ${(file as File).name}: HTTP ${response.status}`);
            }
        } catch (e) {
            console.error('External upload error:', e);
        }
    }

    // Fallback to local
    if (!filePath) {
        const buffer = Buffer.from(await (file as File).arrayBuffer());
        const fileName = `${uuid}-${Date.now()}-${(file as File).name.replace(/\s+/g, '_')}`;
        filePath = `/uploads/${fileName}`;
        await writeFile(path.join(uploadDir, fileName), buffer);
    }

    return filePath;
}

export async function getSidebarCounts() {
    const session = await auth();
    if (!session?.user?.id) return { inbox: 0, important: 0, actions: 0, sent: 0, drafts: 0 };
    const userId = parseInt(session.user.id);

    try {
        // One query for every count: the sidebar polls this, and each separate query
        // costs a full round trip to the database.
        const countsSql = (withReplies: boolean) => `
            SELECT
                (SELECT COUNT(*) FROM memo_recipients mr JOIN memos m ON mr.memo_id = m.id
                  WHERE mr.recipient_id = ? AND mr.acknowledged_at IS NULL AND m.status = 'Distributed') AS unread_inbox,
                (SELECT COUNT(*) FROM memo_approvals a JOIN memos m ON a.memo_id = m.id
                  WHERE a.approver_id = ? AND a.status = 'Pending'
                    AND NOT EXISTS (SELECT 1 FROM memo_approvals a2
                                     WHERE a2.memo_id = m.id AND a2.step_order < a.step_order AND a2.status != 'Approved')) AS pending_approvals,
                (SELECT COUNT(*) FROM memo_consultations c
                  WHERE c.to_user_id = ? AND c.type = 'Forward'
                    AND NOT EXISTS (SELECT 1 FROM memo_consultations r
                                     WHERE r.parent_id = c.id AND r.from_user_id = ? AND r.type = 'Response')) AS pending_consultations,
                (SELECT COUNT(*) FROM memos m
                   LEFT JOIN memo_recipients mr ON m.id = mr.memo_id AND mr.recipient_id = ?
                   LEFT JOIN memo_approvals a ON m.id = a.memo_id AND a.approver_id = ?
                  WHERE m.priority = 'High'
                    AND ((mr.recipient_id = ? AND mr.acknowledged_at IS NULL AND m.status = 'Distributed')
                      OR (a.approver_id = ? AND a.status = 'Pending' AND NOT EXISTS (
                            SELECT 1 FROM memo_approvals a2
                             WHERE a2.memo_id = m.id AND a2.step_order < a.step_order AND a2.status != 'Approved')))) AS important,
                (SELECT COUNT(*) FROM memos WHERE created_by = ? AND status = 'Draft') AS drafts,
                (SELECT COUNT(*) FROM memos WHERE created_by = ? AND status != 'Draft') AS sent,
                (SELECT COUNT(*) FROM memo_finance_processing fp
                  WHERE fp.status IN ('Pending Processing', 'In Progress', 'Partially Paid')) AS accountant_queue,
                ${withReplies
                    ? `(SELECT COUNT(DISTINCT mr.memo_id) FROM memo_reply_recipients rr JOIN memo_replies mr ON mr.id = rr.reply_id
                         WHERE rr.user_id = ? AND rr.read_at IS NULL)`
                    : '0'} AS unread_replies
        `;
        const params = [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId];
        // Reply tables may not be migrated yet on an older database
        const rows = await query(countsSql(true), [...params, userId])
            .catch(() => query(countsSql(false), params)) as any[];
        const c = rows[0] || {};
        const num = (v: unknown) => Number(v) || 0;
        const pendingApprovals = { count: num(c.pending_approvals) };
        const pendingConsultations = { count: num(c.pending_consultations) };
        const unreadInbox = { count: num(c.unread_inbox) };
        const unreadReplies = { count: num(c.unread_replies) };
        const importantCount = { count: num(c.important) };
        const draftsCount = { count: num(c.drafts) };
        const sentCount = { count: num(c.sent) };
        const accountantQueue = { count: num(c.accountant_queue) };

        const actions = (pendingApprovals?.count || 0) + (pendingConsultations?.count || 0);
        const inbox = (unreadInbox?.count || 0) + actions + (unreadReplies?.count || 0);

        return {
            inbox,
            important: importantCount?.count || 0,
            actions,
            sent: sentCount?.count || 0,
            drafts: draftsCount?.count || 0,
            accountant_queue: accountantQueue?.count || 0
        };
    } catch (e) {
        console.error('getSidebarCounts error:', e);
        return { inbox: 0, important: 0, actions: 0, sent: 0, drafts: 0, accountant_queue: 0 };
    }
}

// ─── DRAFT MEMO ACTIONS ───────────────────────────────────────────────────────

export async function deleteDraftMemo(memoId: number) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    try {
        // Ensure the memo belongs to this user AND is still a draft
        const rows = await query(
            `SELECT id FROM memos WHERE id = ? AND created_by = ? AND status = 'Draft' LIMIT 1`,
            [memoId, userId]
        ) as any[];

        if (rows.length === 0) {
            return { success: false, error: 'Draft not found or already submitted.' };
        }

        // Cascade-delete all related rows then the memo itself
        await query(`DELETE FROM memo_budget_items WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memo_budget_info  WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memo_recipients   WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memo_approvals    WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM attachments        WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memos             WHERE id = ?`,      [memoId]);

        revalidatePath('/dashboard/tasks');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error('deleteDraftMemo error:', e);
        return { success: false, error: friendlyError(e, "We couldn't delete this draft. Please try again.") };
    }
}

export async function updateDraftMemo(memoId: number, data: FormData, submitNow: boolean) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    try {
        const rows = await query(
            `SELECT id, uuid, vendor_id FROM memos WHERE id = ? AND created_by = ? AND status = 'Draft' LIMIT 1`,
            [memoId, userId]
        ) as any[];

        if (rows.length === 0) return { success: false, error: 'Draft not found.' };
        const { uuid } = rows[0];

        const title         = data.get('title') as string;
        const content       = data.get('content') as string;
        const department    = data.get('department') as string;
        const category      = data.get('category') as string;
        const priority      = data.get('priority') as string;
        const memo_type     = data.get('memo_type') as string;
        const expiry_date   = data.get('expiry_date') as string || null;
        const is_budget     = data.get('is_budget_memo') === 'true';
        // A vendor deactivated after it was linked may stay; new links must be active
        const vendorId      = await resolveVendorId(data.get('vendor_id'), rows[0].vendor_id);

        // Update core memo
        await query(
            `UPDATE memos SET title=?, content=?, department=?, category=?, priority=?, memo_type=?, expiry_date=?, vendor_id=?, updated_at=NOW()
             WHERE id = ?`,
            [title, content, department, category, priority, memo_type, expiry_date, vendorId, memoId]
        );

        // Refresh recipients
        await query(`DELETE FROM memo_recipients WHERE memo_id = ?`, [memoId]);
        const recipientIds: number[] = JSON.parse(data.get('recipient_ids') as string || '[]');
        const ccIds:        number[] = JSON.parse(data.get('cc_ids')        as string || '[]');
        const bccIds:       number[] = JSON.parse(data.get('bcc_ids')       as string || '[]');

        const allRecipients = [
            ...recipientIds.map(id => ({ id, type: 'To' })),
            ...ccIds.map(id        => ({ id, type: 'CC' })),
            ...bccIds.map(id       => ({ id, type: 'BCC' })),
        ];
        for (const r of allRecipients) {
            await query(
                `INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, ?)`,
                [memoId, r.id, r.type]
            );
        }

        // Budget info refresh
        await query(`DELETE FROM memo_budget_info  WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memo_budget_items WHERE memo_id = ?`, [memoId]);
        if (is_budget) {
            const year_id         = data.get('year_id') as string;
            const budget_category = data.get('budget_category') as string;
            const other_category  = data.get('other_category') as string;
            const budgetItems     = JSON.parse(data.get('budget_items') as string || '[]');
            const itemCategories  = Array.from(new Set(budgetItems.map((i: any) => i.budget_category).filter(Boolean)));
            const finalBudgetCategory = itemCategories.length > 0 ? itemCategories.join(', ') : budget_category;

            await query(
                `INSERT INTO memo_budget_info (memo_id, year_id, budget_category, other_category) VALUES (?, ?, ?, ?)`,
                [memoId, year_id, finalBudgetCategory, other_category]
            );
            for (const item of budgetItems) {
                const subtotal = (item.quantity || 1) * (item.amount || 0);
                let finalDesc = item.description || '';
                if (item.budget_category && !finalDesc.startsWith(`[${item.budget_category}]`)) {
                    finalDesc = finalDesc ? `[${item.budget_category}] ${finalDesc}` : `[${item.budget_category}]`;
                }
                await query(
                    `INSERT INTO memo_budget_items (memo_id, name, description, quantity, amount, total) VALUES (?, ?, ?, ?, ?, ?)`,
                    [memoId, item.name, finalDesc, item.quantity || 1, item.amount || 0, subtotal]
                );
            }
        }

        if (submitNow) {
            // Route the memo for approval just like createMemo does
            const userResult = await query(
                'SELECT line_manager_id FROM memo_system_users WHERE id = ?', [userId]
            ) as any[];
            const managerId = userResult[0]?.line_manager_id;

            if (managerId) {
                await query(
                    'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                    [memoId, managerId, 1, 'Pending']
                );
                await query('UPDATE memos SET status = "Line Manager Review" WHERE id = ?', [memoId]);
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [managerId, memoId, `A new memo "${title}" requires your validation.`]
                );

                // Trigger email notification to the manager
                await sendMemoNotificationEmail(memoId, 'SUBMITTED');
            } else {
                await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);

                // Trigger email notifications to recipients & creator for automatic distribution
                await sendMemoNotificationEmail(memoId, 'DISTRIBUTED');
            }
        }

        revalidatePath('/dashboard/tasks');
        revalidatePath(`/dashboard/memos/${uuid}`);
        revalidatePath('/dashboard');
        return { success: true, memoUuid: uuid };
    } catch (e: any) {
        console.error('updateDraftMemo error:', e);
        return { success: false, error: friendlyError(e, "We couldn't save your changes to this draft. Please try again.") };
    }
}

// ─── REJECTED MEMO EDIT ───────────────────────────────────────────────────────

export async function updateRejectedMemo(memoId: number, data: FormData, submitNow: boolean) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    try {
        // 1. Verify memo belongs to user and is in Draft status
        const rows = await query(
            `SELECT id, uuid, title, vendor_id FROM memos WHERE id = ? AND created_by = ? AND status = 'Draft' LIMIT 1`,
            [memoId, userId]
        ) as any[];
        if (rows.length === 0) return { success: false, error: 'Memo not found or not in Draft status.' };
        const { uuid } = rows[0];

        // 2. Verify there is at least one Rejected approval record (this is the edit gate)
        const rejections = await query(
            `SELECT id FROM memo_approvals WHERE memo_id = ? AND status = 'Rejected' LIMIT 1`,
            [memoId]
        ) as any[];
        if (rejections.length === 0) {
            return { success: false, error: 'This memo has not been rejected and cannot be edited.' };
        }

        const title       = data.get('title') as string;
        const content     = data.get('content') as string;
        const department  = data.get('department') as string;
        let   category    = data.get('category') as string;
        const custom_cat  = data.get('custom_category') as string;
        if (category === 'Others' && custom_cat) category = custom_cat;
        const priority    = data.get('priority') as string;
        const memo_type   = data.get('memo_type') as string;
        const expiry_date = data.get('expiry_date') as string || null;
        const is_budget   = data.get('is_budget_memo') === 'true';
        // A vendor deactivated after it was linked may stay; new links must be active
        const vendorId    = await resolveVendorId(data.get('vendor_id'), rows[0].vendor_id);

        // 3. Update core memo fields
        await query(
            `UPDATE memos SET title=?, content=?, department=?, category=?, priority=?, memo_type=?, expiry_date=?, vendor_id=?, updated_at=NOW()
             WHERE id = ?`,
            [title, content, department, category, priority, memo_type, expiry_date, vendorId, memoId]
        );

        // 4. Refresh recipients
        await query(`DELETE FROM memo_recipients WHERE memo_id = ?`, [memoId]);
        const recipientIds: number[] = JSON.parse(data.get('recipient_ids') as string || '[]');
        const ccIds: number[]        = JSON.parse(data.get('cc_ids')        as string || '[]');
        const bccIds: number[]       = JSON.parse(data.get('bcc_ids')       as string || '[]');
        const allRecipients = [
            ...recipientIds.map(id => ({ id, type: 'To' })),
            ...ccIds.map(id        => ({ id, type: 'CC' })),
            ...bccIds.map(id       => ({ id, type: 'BCC' })),
        ];
        for (const r of allRecipients) {
            await query(
                `INSERT IGNORE INTO memo_recipients (memo_id, recipient_id, recipient_type) VALUES (?, ?, ?)`,
                [memoId, r.id, r.type]
            );
        }

        // 5. Refresh budget info
        await query(`DELETE FROM memo_budget_info  WHERE memo_id = ?`, [memoId]);
        await query(`DELETE FROM memo_budget_items WHERE memo_id = ?`, [memoId]);
        if (is_budget) {
            const year_id         = data.get('year_id') as string;
            const budget_category = data.get('budget_category') as string;
            const other_category  = data.get('other_category') as string;
            const budgetItems     = JSON.parse(data.get('budget_items') as string || '[]');
            const itemCategories  = Array.from(new Set(budgetItems.map((i: any) => i.budget_category).filter(Boolean)));
            const finalBudgetCategory = itemCategories.length > 0 ? itemCategories.join(', ') : budget_category;

            await query(
                `INSERT INTO memo_budget_info (memo_id, year_id, budget_category, other_category) VALUES (?, ?, ?, ?)`,
                [memoId, year_id, finalBudgetCategory, other_category]
            );
            for (const item of budgetItems) {
                const subtotal = (item.quantity || 1) * (item.amount || 0);
                let finalDesc = item.description || '';
                if (item.budget_category && !finalDesc.startsWith(`[${item.budget_category}]`)) {
                    finalDesc = finalDesc ? `[${item.budget_category}] ${finalDesc}` : `[${item.budget_category}]`;
                }
                await query(
                    `INSERT INTO memo_budget_items (memo_id, name, description, quantity, amount, total) VALUES (?, ?, ?, ?, ?, ?)`,
                    [memoId, item.name, finalDesc, item.quantity || 1, item.amount || 0, subtotal]
                );
            }
        }

        // 6. Attachments (remove existing / add new)
        await applyAttachmentChanges(memoId, uuid, data, userId);

        // 7. Re-submit flow
        if (submitNow) {
            // Clear ALL previous approval records (Rejected + any old Pending) for a clean re-submission
            await query(`DELETE FROM memo_approvals WHERE memo_id = ?`, [memoId]);

            const userResult = await query(
                'SELECT line_manager_id FROM memo_system_users WHERE id = ?', [userId]
            ) as any[];
            const managerId = userResult[0]?.line_manager_id;

            if (managerId) {
                await query(
                    'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                    [memoId, managerId, 1, 'Pending']
                );
                await query('UPDATE memos SET status = "Line Manager Review" WHERE id = ?', [memoId]);
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [managerId, memoId, `The revised memo "${title}" has been resubmitted for your review.`]
                );

                // Trigger email notification to the manager for resubmission
                await sendMemoNotificationEmail(memoId, 'RESUBMITTED');
            } else {
                await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);

                // Trigger email notifications to recipients & creator for automatic distribution
                await sendMemoNotificationEmail(memoId, 'DISTRIBUTED');
            }

            await query(
                'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [userId, 'RESUBMIT_MEMO', 'memos', memoId, JSON.stringify({ title })]
            );
        } else {
            // Just saving — keep as Draft
            await query(
                'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [userId, 'EDIT_REJECTED_MEMO', 'memos', memoId, JSON.stringify({ title })]
            );
        }

        revalidatePath(`/dashboard/memos/${uuid}`);
        revalidatePath(`/dashboard/memos/${uuid}/edit`);
        revalidatePath('/dashboard/tasks');
        revalidatePath('/dashboard');
        return { success: true, memoUuid: uuid };
    } catch (e: any) {
        console.error('updateRejectedMemo error:', e);
        return { success: false, error: friendlyError(e, "We couldn't save your changes to this memo. Please try again.") };
    }
}

// ─── REVISE MEMO AFTER AN INPUT REQUEST ──────────────────────────────────────

// A memo in review or already distributed can be revised by its creator once
// someone has asked them for input or commented on it (a consultation
// addressed to the creator). Rejected memos use updateRejectedMemo instead.
async function fetchInputRequests(memoId: number, creatorId: number) {
    return await query(`
        SELECT mc.id, mc.from_user_id, mc.message, mc.type, mc.created_at,
               COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as from_name
        FROM memo_consultations mc
        JOIN memo_system_users u ON mc.from_user_id = u.id
        LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
        WHERE mc.memo_id = ? AND mc.to_user_id = ? AND mc.from_user_id != ?
        ORDER BY mc.created_at DESC
    `, [memoId, creatorId, creatorId]) as any[];
}

// Input requests addressed to the signed-in user on a memo they created.
export async function getMyInputRequests(memoId: number) {
    const session = await auth();
    if (!session?.user?.id) return [];
    const userId = parseInt(session.user.id);
    const owns = await query('SELECT 1 FROM memos WHERE id = ? AND created_by = ?', [memoId, userId]) as any[];
    return owns.length > 0 ? fetchInputRequests(memoId, userId) : [];
}

export async function reviseMemoContent(memoId: number, data: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    try {
        const rows = await query(
            `SELECT id, uuid, title, content, status FROM memos WHERE id = ? AND created_by = ? LIMIT 1`,
            [memoId, userId]
        ) as any[];
        if (rows.length === 0) return { success: false, error: 'Memo not found.' };
        const memo = rows[0];
        if (memo.status === 'Draft') return { success: false, error: 'Draft memos are edited from the draft editor.' };

        const requests = await fetchInputRequests(memoId, userId);
        if (requests.length === 0) {
            return { success: false, error: 'This memo can only be edited after input has been requested from you.' };
        }

        const title = ((data.get('title') as string) || '').trim();
        const content = (data.get('content') as string) || '';
        if (!title) return { success: false, error: 'Title is required.' };
        if (!content.replace(/<[^>]*>/g, '').trim()) return { success: false, error: 'Memo content cannot be empty.' };

        await query('UPDATE memos SET title = ?, content = ?, updated_at = NOW() WHERE id = ?', [title, content, memoId]);
        const { removedCount, added } = await applyAttachmentChanges(memoId, memo.uuid, data, userId);

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, 'REVISE_MEMO', 'memos', memoId,
                JSON.stringify({ title: memo.title, content: memo.content }),
                JSON.stringify({ title, content, removedAttachments: removedCount, addedAttachments: added })]
        );

        // Let everyone who asked for input (and the current approver) know
        const notifyIds = new Set<number>(requests.map((r: any) => r.from_user_id));
        const pending = await query(
            'SELECT approver_id FROM memo_approvals WHERE memo_id = ? AND status = "Pending" ORDER BY step_order ASC LIMIT 1',
            [memoId]
        ) as any[];
        if (pending.length > 0) notifyIds.add(pending[0].approver_id);
        notifyIds.delete(userId);

        for (const id of notifyIds) {
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [id, memoId, `${session.user.name} has updated the memo "${title}" in response to the input requested.`]
            );
        }

        revalidatePath(`/dashboard/memos/${memo.uuid}`);
        revalidatePath('/dashboard');
        return { success: true, memoUuid: memo.uuid };
    } catch (e: any) {
        console.error('reviseMemoContent error:', e);
        return { success: false, error: friendlyError(e, "We couldn't save your changes to this memo. Please try again.") };
    }
}

/**
 * Enables attaching documents/files to any memo (including already routed, in-review, or distributed memos).
 * Fully audited for record purposes in audit_logs, attachments table, and notifications.
 */
export async function addAttachmentToMemo(memoId: number, data: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: 'Unauthorized. Please log in.' };
    const userId = parseInt(session.user.id);

    try {
        const memos = await query(
            'SELECT id, uuid, title, status, created_by FROM memos WHERE id = ? LIMIT 1',
            [memoId]
        ) as any[];
        if (memos.length === 0) return { success: false, error: 'Memo not found.' };
        const memo = memos[0];

        const isCreator = memo.created_by === userId;
        const recipients = await query('SELECT recipient_id FROM memo_recipients WHERE memo_id = ?', [memoId]) as any[];
        const isRecipient = recipients.some((r: any) => r.recipient_id === userId);
        const approvals = await query('SELECT approver_id FROM memo_approvals WHERE memo_id = ?', [memoId]) as any[];
        const isApprover = approvals.some((a: any) => a.approver_id === userId);
        const roles: string[] = (session?.user as any)?.role || [];
        const isAdmin = roles.includes('Administrator');

        // Creator (submitter), recipients, approvers, and administrators are authorized
        if (!isCreator && !isRecipient && !isApprover && !isAdmin) {
            return { success: false, error: 'You are not authorized to attach files to this memo.' };
        }

        const reason = ((data.get('reason') as string) || '').trim();
        const uploadedFiles = parseUploaded(data.get('uploaded_attachments'));
        const rawFiles = (data.getAll('attachments') as File[]).filter(
            f => f && typeof f !== 'string' && f.size > 0
        );

        if (uploadedFiles.length === 0 && rawFiles.length === 0) {
            return { success: false, error: 'Please select at least one file to attach.' };
        }

        // Fetch user's display name
        const userRows = await query(`
            SELECT u.id,
                   COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
            FROM memo_system_users u
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            WHERE u.id = ?
        `, [userId]) as any[];
        const userName = userRows[0]?.full_name || session.user?.name || 'User';

        const addedFiles: Array<{ name: string; path: string; size: number; type: string }> = [];

        // Direct upload files
        for (const uploaded of uploadedFiles) {
            await query(
                'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    memoId,
                    uploaded.name.substring(0, 255),
                    uploaded.url.substring(0, 255),
                    (uploaded.type || '').substring(0, 255),
                    uploaded.size || 0,
                    userId,
                    reason || null
                ]
            );
            addedFiles.push({
                name: uploaded.name,
                path: uploaded.url,
                size: uploaded.size,
                type: uploaded.type
            });
        }

        // Multipart FormData files
        for (const file of rawFiles) {
            const filePath = await uploadFile(file, memo.uuid);
            await query(
                'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size, uploaded_by, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    memoId,
                    file.name.substring(0, 255),
                    filePath.substring(0, 255),
                    file.type.substring(0, 255),
                    file.size,
                    userId,
                    reason || null
                ]
            );
            addedFiles.push({
                name: file.name,
                path: filePath,
                size: file.size,
                type: file.type
            });
        }

        const userRole = isCreator ? 'Creator' : isRecipient ? 'Recipient' : isApprover ? 'Approver' : 'Administrator';

        // Audit log entry for institutional record keeping
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [
                userId,
                'ADD_ATTACHMENT',
                'memos',
                memoId,
                JSON.stringify({
                    action: 'ADD_ATTACHMENT',
                    attachedByName: userName,
                    userRole,
                    memoStatus: memo.status,
                    reason: reason || null,
                    addedAttachments: addedFiles
                })
            ]
        );

        // Stakeholder notifications
        const notifyUserIds = new Set<number>();
        if (isCreator) {
            if (memo.status === 'Distributed') {
                recipients.forEach((r: any) => notifyUserIds.add(r.recipient_id));
            } else {
                const pendingApprovals = await query(
                    'SELECT approver_id FROM memo_approvals WHERE memo_id = ? AND status = "Pending"',
                    [memoId]
                ) as any[];
                pendingApprovals.forEach((a: any) => notifyUserIds.add(a.approver_id));
            }
        } else {
            notifyUserIds.add(memo.created_by);
        }
        notifyUserIds.delete(userId);

        const fileNames = addedFiles.map(f => f.name).join(', ');
        for (const targetId of notifyUserIds) {
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [
                    targetId,
                    memoId,
                    `${userName} (${userRole}) attached ${addedFiles.length} document(s) (${fileNames}) to memo "${memo.title}".`
                ]
            );
        }

        revalidatePath(`/dashboard/memos/${memo.uuid}`);
        revalidatePath('/dashboard/tasks');
        revalidatePath('/dashboard');

        return { success: true, count: addedFiles.length, memoUuid: memo.uuid };
    } catch (e: any) {
        console.error('addAttachmentToMemo error:', e);
        return { success: false, error: friendlyError(e, "We couldn't attach the file. Please try again.") };
    }
}

// ─── ACCOUNTANT FINANCE PROCESSING ACTIONS ───────────────────────────────────

// The Accountant works the finance queue; Administrators can view and act on it too.
function isAccountantUser(session: any) {
    const roles: string[] = (session?.user as any)?.role || [];
    return roles.includes('Accountant') || String(session?.user?.email || '').toLowerCase().includes('chidi.ojiako');
}

function canAccessFinanceQueue(session: any) {
    const roles: string[] = (session?.user as any)?.role || [];
    return isAccountantUser(session) || roles.includes('Administrator');
}

export async function getAccountantFinanceMemos(statusFilter?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!canAccessFinanceQueue(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };

    try {
        let whereClause = '';
        const params: any[] = [];

        if (statusFilter && statusFilter !== 'All') {
            whereClause = ' WHERE fp.status = ?';
            params.push(statusFilter);
        }

        const memos = await query(`
            SELECT 
                fp.id as processing_id,
                fp.memo_id,
                fp.status as processing_status,
                fp.processing_notes,
                fp.voucher_number,
                fp.payee_name,
                fp.payee_address,
                fp.total_amount,
                fp.vendor_id as finance_vendor_id,
                m.vendor_id as memo_vendor_id,
                v.vendor_id, v.vendor_name, v.email_address as vendor_email, v.phone_number as vendor_phone,
                v.address as vendor_address, v.bank_name as vendor_bank_name, v.account_name as vendor_account_name,
                v.account_number as vendor_account_number, v.is_active as vendor_is_active,
                (SELECT COALESCE(SUM(p.amount), 0) FROM memo_finance_payments p WHERE p.processing_id = fp.id) as paid_amount,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', p.id, 'amount', p.amount, 'voucher_number', p.voucher_number,
                                                  'payment_note', p.payment_note, 'paid_at', p.paid_at))
                   FROM memo_finance_payments p WHERE p.processing_id = fp.id) as payments_json,
                fp.bank_name,
                fp.account_name,
                fp.account_number,
                fp.processed_at,
                fp.created_at as routed_at,
                m.uuid,
                m.reference_number,
                m.title,
                m.category,
                m.priority,
                m.status as memo_status,
                m.created_at as memo_created_at,
                m.updated_at as memo_updated_at,
                COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as creator_name,
                COALESCE(hd.DesignationName, 'Staff') as creator_designation,
                COALESCE(
                    (SELECT SUM(total) FROM memo_budget_items WHERE memo_id = m.id),
                    0
                ) as total_budget_amount,
                (SELECT COUNT(*) FROM memo_budget_items WHERE memo_id = m.id) as budget_items_count,
                bi.budget_category
            FROM memo_finance_processing fp
            JOIN memos m ON fp.memo_id = m.id
            JOIN memo_system_users u ON m.created_by = u.id
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
            LEFT JOIN memo_budget_info bi ON m.id = bi.memo_id
            -- The vendor Finance chose, else the vendor named on the memo
            LEFT JOIN inventory_vendor v ON v.vendor_id = COALESCE(fp.vendor_id, m.vendor_id)
            ${whereClause}
            ORDER BY fp.created_at DESC
        `, params) as any[];

        return { success: true, memos };
    } catch (error: any) {
        console.error('getAccountantFinanceMemos Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't load the finance queue. Please refresh the page.") };
    }
}

export type FinanceAccountDetails = {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
};

export type FinanceProcessingInput = {
    /** Pending Processing / In Progress / Processed / Rejected. Partially Paid is set automatically. */
    status: 'Pending Processing' | 'In Progress' | 'Partially Paid' | 'Processed' | 'Rejected';
    notes?: string;
    account?: FinanceAccountDetails;
    /** vendorId: registered vendor being paid (shared vendor list), if any. */
    payee?: { name?: string; address?: string; vendorId?: number | null };
    /** Total amount the university owes on this memo (NGN). */
    totalAmount?: number | string | null;
    /** Optional payment being made now. */
    payment?: { amount?: number | string | null; note?: string } | null;
};

// Money is handled in kobo (integers) to avoid rounding errors.
const toKobo = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
};
const koboToNaira = (kobo: number) => (kobo / 100).toFixed(2);
const formatNaira = (kobo: number) =>
    `NGN ${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Next Payment Voucher number for this year: PV/CUA/<year>/<0001>. Must run on the
// transaction's connection (LAST_INSERT_ID is per connection).
async function nextVoucherNumber(connection: any) {
    const year = new Date().getFullYear();
    await connection.execute(
        `INSERT INTO memo_voucher_sequences (year, last_number) VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
        [year]
    );
    const [seqRows] = await connection.execute('SELECT LAST_INSERT_ID() AS n') as any[];
    return `PV/CUA/${year}/${String(Number(seqRows[0].n)).padStart(4, '0')}`;
}

/**
 * Saves the accountant's processing record for a finance memo.
 * - Payee (vendor / company / organisation) name and address, the total amount owed,
 *   and the beneficiary bank account.
 * - Optional payment now: may be part of the total. Each payment gets its own
 *   Payment Voucher number (PV/CUA/<year>/<0001>).
 * - Status follows the payments: some paid -> Partially Paid; all paid -> Processed.
 *   With no payments the accountant chooses Pending Processing, In Progress or Rejected.
 */
export async function updateFinanceMemoProcessingStatus(processingId: number, input: FinanceProcessingInput) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    if (!canAccessFinanceQueue(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);

    const requestedStatus = input?.status;
    if (!['Pending Processing', 'In Progress', 'Partially Paid', 'Processed', 'Rejected'].includes(requestedStatus)) {
        return { success: false, error: 'Choose a valid processing status.' };
    }

    const notes = (input.notes || '').trim();
    const bankName = (input.account?.bankName || '').trim();
    const accountName = (input.account?.accountName || '').trim();
    const accountNumber = (input.account?.accountNumber || '').replace(/\s+/g, '');
    const payeeName = (input.payee?.name || '').trim();
    const payeeAddress = (input.payee?.address || '').trim();
    const totalKobo = toKobo(input.totalAmount);
    const payKobo = toKobo(input.payment?.amount);
    const paymentNote = (input.payment?.note || '').trim();

    if (bankName.length > 120) return { success: false, error: 'Bank name must be at most 120 characters.' };
    if (accountName.length > 150) return { success: false, error: 'Account name must be at most 150 characters.' };
    if (accountNumber && !/^\d{10}$/.test(accountNumber)) return { success: false, error: 'Account number must be exactly 10 digits.' };
    if (payeeName.length > 200) return { success: false, error: 'Payee name must be at most 200 characters.' };
    if (payeeAddress.length > 500) return { success: false, error: 'Payee address must be at most 500 characters.' };
    if (paymentNote.length > 500) return { success: false, error: 'Payment note must be at most 500 characters.' };
    if (Number.isNaN(totalKobo)) return { success: false, error: 'Enter the total amount as a number, e.g. 700000.' };
    if (totalKobo !== null && totalKobo < 0) return { success: false, error: 'The total amount cannot be negative.' };
    if (totalKobo !== null && totalKobo > 999999999999999) return { success: false, error: 'The total amount is too large.' };
    if (Number.isNaN(payKobo)) return { success: false, error: 'Enter the amount to pay as a number, e.g. 400000.' };
    if (payKobo !== null && payKobo <= 0) return { success: false, error: 'The amount to pay must be more than zero.' };

    const paying = payKobo !== null && payKobo > 0;
    if (paying || requestedStatus === 'Processed') {
        if (!payeeName || !payeeAddress) {
            return { success: false, error: 'Enter the payee name and address before recording a payment.' };
        }
        if (!bankName || !accountName || !accountNumber) {
            return { success: false, error: 'Enter the bank name, account name and account number before recording a payment.' };
        }
        if (!totalKobo) return { success: false, error: 'Enter the total amount owed before recording a payment.' };
    }

    const connection = await pool.getConnection();
    let record: any;
    let newVoucher: string | null = null;
    let finalStatus: string = requestedStatus;
    let paidKobo = 0;

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT fp.*, m.id as memo_id, m.created_by, m.title, m.uuid
            FROM memo_finance_processing fp
            JOIN memos m ON fp.memo_id = m.id
            WHERE fp.id = ?
            FOR UPDATE
        `, [processingId]) as any[];
        if (rows.length === 0) {
            await connection.rollback();
            return { success: false, error: 'This finance record could not be found. Refresh the page and try again.' };
        }
        record = rows[0];

        // Registered vendor being paid. One deactivated after it was linked may stay linked.
        const vendorId = await resolveVendorId(input.payee?.vendorId ?? null, record.vendor_id);

        const [paidRows] = await connection.execute(
            'SELECT COALESCE(SUM(amount), 0) AS paid FROM memo_finance_payments WHERE processing_id = ?',
            [processingId]
        ) as any[];
        const previouslyPaidKobo = toKobo(paidRows[0].paid) || 0;

        if (totalKobo !== null && totalKobo < previouslyPaidKobo) {
            await connection.rollback();
            return { success: false, error: `The total amount cannot be less than what has already been paid (${formatNaira(previouslyPaidKobo)}).` };
        }
        const effectiveTotal = totalKobo ?? (toKobo(record.total_amount) || 0);
        const balanceBefore = effectiveTotal - previouslyPaidKobo;

        if (paying && payKobo! > balanceBefore) {
            await connection.rollback();
            return { success: false, error: `The amount to pay is more than the balance left (${formatNaira(balanceBefore)}).` };
        }
        if (requestedStatus === 'Rejected' && (previouslyPaidKobo > 0 || paying)) {
            await connection.rollback();
            return { success: false, error: 'A memo that has already received a payment cannot be marked as Rejected.' };
        }

        paidKobo = previouslyPaidKobo + (paying ? payKobo! : 0);

        // Marking it Processed without paying the remaining balance is not allowed:
        // the balance must be paid (or the total corrected) first.
        if (requestedStatus === 'Processed' && effectiveTotal > 0 && paidKobo < effectiveTotal) {
            await connection.rollback();
            return { success: false, error: `There is still ${formatNaira(effectiveTotal - paidKobo)} left to pay. Record the remaining payment (or correct the total) before marking this memo as Processed.` };
        }

        if (paying) {
            newVoucher = await nextVoucherNumber(connection);
            await connection.execute(
                'INSERT INTO memo_finance_payments (processing_id, amount, voucher_number, payment_note, recorded_by) VALUES (?, ?, ?, ?, ?)',
                [processingId, koboToNaira(payKobo!), newVoucher, paymentNote || null, userId]
            );
        }

        // Status follows the payments
        if (paidKobo > 0 && effectiveTotal > 0 && paidKobo >= effectiveTotal) finalStatus = 'Processed';
        else if (paidKobo > 0) finalStatus = 'Partially Paid';
        else if (requestedStatus === 'Partially Paid') finalStatus = 'In Progress';
        else finalStatus = requestedStatus;

        const isFinal = finalStatus === 'Processed' || finalStatus === 'Rejected';
        // The memo's main voucher number is its first payment's PV
        const mainVoucher = record.voucher_number || newVoucher || null;

        await connection.execute(`
            UPDATE memo_finance_processing
            SET status = ?,
                processing_notes = ?,
                voucher_number = ?,
                payee_name = ?,
                payee_address = ?,
                vendor_id = ?,
                total_amount = ?,
                bank_name = ?,
                account_name = ?,
                account_number = ?,
                processed_at = ?,
                accountant_id = COALESCE(?, accountant_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [finalStatus, notes || null, mainVoucher, payeeName || null, payeeAddress || null, vendorId,
            effectiveTotal > 0 ? koboToNaira(effectiveTotal) : null,
            bankName || null, accountName || null, accountNumber || null,
            isFinal ? new Date() : null,
            // An Administrator acting on the queue keeps the assigned accountant
            isAccountantUser(session) ? userId : null, processingId]);

        // Notify creator
        let message = `Financial processing for your memo "${record.title}" is now: ${finalStatus}.`;
        if (paying) {
            message += ` ${formatNaira(payKobo!)} was paid (Payment Voucher ${newVoucher}).`;
            if (effectiveTotal - paidKobo > 0) message += ` ${formatNaira(effectiveTotal - paidKobo)} is left to be settled later.`;
        }
        await connection.execute(
            'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
            [record.created_by, record.memo_id, message]
        );

        // Audit log (account number masked)
        await connection.execute(`
            INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
            VALUES (?, 'UPDATE_FINANCE_PROCESSING', 'memo_finance_processing', ?, ?)
        `, [userId, processingId, JSON.stringify({
            status: finalStatus,
            notes,
            payeeName: payeeName || null,
            vendorId,
            totalAmount: effectiveTotal > 0 ? koboToNaira(effectiveTotal) : null,
            payment: paying ? { amount: koboToNaira(payKobo!), voucherNumber: newVoucher, note: paymentNote || null } : null,
            paidSoFar: koboToNaira(paidKobo),
            balance: koboToNaira(Math.max(effectiveTotal - paidKobo, 0)),
            bankName: bankName || null,
            accountName: accountName || null,
            accountNumber: accountNumber ? `******${accountNumber.slice(-4)}` : null
        })]);

        // First time Finance records bank details for a vendor: keep them on the vendor
        // record so later payments to the same vendor are pre-filled.
        if (vendorId && bankName && accountName && accountNumber) {
            await connection.execute(`
                UPDATE inventory_vendor
                   SET bank_name = ?, account_name = ?, account_number = ?, updated_date = NOW()
                 WHERE vendor_id = ? AND COALESCE(bank_name, '') = '' AND COALESCE(account_number, '') = ''
            `, [bankName, accountName, accountNumber, vendorId]);
        }

        await connection.commit();

        revalidatePath('/dashboard/accountant');
        revalidatePath('/dashboard/vendors');
        revalidatePath(`/dashboard/memos/${record.uuid}`);
        revalidatePath('/dashboard/tasks');
        revalidatePath('/dashboard');

        return {
            success: true,
            status: finalStatus,
            voucherNumber: newVoucher,
            paid: Number(koboToNaira(paidKobo)),
            balance: Number(koboToNaira(Math.max(effectiveTotal - paidKobo, 0)))
        };
    } catch (error: any) {
        await connection.rollback().catch(() => {});
        console.error('updateFinanceMemoProcessingStatus Error:', error);
        return { success: false, error: friendlyError(error, "We couldn't save the processing record. Please try again.") };
    } finally {
        connection.release();
    }
}

// ─── APPROVER GROUP (Settings > Approvers Settings) ──────────────────────────

export async function isCurrentUserApproverGroupMember() {
    const session = await auth();
    if (!session?.user?.id) return false;
    return isApproverGroupMember(session.user.id);
}

function isAdministrator(session: any) {
    return !!session?.user && (session.user as any).role?.includes('Administrator');
}

export async function getApproverGroupMembers() {
    const session = await auth();
    if (!isAdministrator(session)) return { success: false as const, error: NOT_AUTHORIZED_MESSAGE };

    try {
        const members = await query(`
            SELECT u.id, u.email, u.department, g.created_at as added_at,
                   COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name,
                   hd.DesignationName as designation
            FROM memo_approver_group g
            JOIN memo_system_users u ON g.user_id = u.id
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
            ORDER BY g.created_at ASC
        `) as any[];
        return { success: true as const, members };
    } catch (error: any) {
        console.error('getApproverGroupMembers error:', error);
        return { success: false as const, error: 'Failed to load approvers. Has the approver group migration been run?' };
    }
}

export async function searchUsersForApproverGroup(searchTerm: string) {
    const session = await auth();
    if (!isAdministrator(session)) return [];

    try {
        const users = await query(`
            SELECT u.id, u.email, u.department,
                   COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name,
                   hd.DesignationName as designation
            FROM memo_system_users u
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            LEFT JOIN hr_designation hd ON hs.DesignationID = hd.EntryID
            WHERE u.is_active = 1
            AND u.id NOT IN (SELECT user_id FROM memo_approver_group)
            AND (u.username LIKE ? OR u.email LIKE ? OR hs.FirstName LIKE ? OR hs.Surname LIKE ? OR hd.DesignationName LIKE ?)
            LIMIT 15
        `, Array(5).fill(`%${searchTerm}%`)) as any[];
        return users;
    } catch (error) {
        console.error('searchUsersForApproverGroup error:', error);
        return [];
    }
}

export async function addApproverGroupMember(userId: number) {
    const session = await auth();
    if (!isAdministrator(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };

    try {
        await query('INSERT IGNORE INTO memo_approver_group (user_id, added_by) VALUES (?, ?)', [userId, session!.user!.id]);
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session!.user!.id, 'ADD_APPROVER_GROUP_MEMBER', 'memo_approver_group', userId]
        );
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('addApproverGroupMember error:', error);
        return { success: false, error: 'Failed to add approver.' };
    }
}

export async function removeApproverGroupMember(userId: number) {
    const session = await auth();
    if (!isAdministrator(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };

    try {
        await query('DELETE FROM memo_approver_group WHERE user_id = ?', [userId]);
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session!.user!.id, 'REMOVE_APPROVER_GROUP_MEMBER', 'memo_approver_group', userId]
        );
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('removeApproverGroupMember error:', error);
        return { success: false, error: 'Failed to remove approver.' };
    }
}
