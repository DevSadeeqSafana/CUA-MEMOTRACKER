import nodemailer from 'nodemailer';
import { query } from './db';

// Create the Nodemailer SMTP transporter using env variables.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
});

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
}

/**
 * Sends an email using the configured transporter.
 * Any errors are caught and logged, returning success: false, so it never throws and interrupts server actions.
 */
export async function sendMemoEmail({ to, subject, bodyHtml, bodyText }: SendEmailOptions) {
    // If not configured, just log it to prevent issues during dev
    if (!process.env.SMTP_HOST || process.env.SMTP_HOST === 'your-smtp-host') {
        console.warn('[Mailer] SMTP is not configured. Skipping email send.');
        return { success: false, error: 'SMTP not configured' };
    }

    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"CUA Memo Tracker" <noreply@cua.edu.ng>',
            to,
            subject,
            text: bodyText,
            html: bodyHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error('[Mailer] Error sending email:', error);
        return { success: false, error: error.message || error };
    }
}

/**
 * Generates a branded HTML template matching the navy/white palette of CUA Memo System.
 */
export function getEmailTemplate(options: {
    recipientName: string;
    title: string;
    previewText: string;
    paragraphs: string[];
    actionUrl?: string;
    actionLabel?: string;
    quoteText?: string;
}) {
    const { recipientName, title, previewText, paragraphs, actionUrl, actionLabel, quoteText } = options;

    const formattedParagraphs = paragraphs.map(p => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #334155;">${p}</p>`).join('');

    const actionButton = actionUrl && actionLabel
        ? `
        <div style="margin: 32px 0 24px; text-align: center;">
            <a href="${actionUrl}" target="_blank" style="background-color: #1a365d; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                ${actionLabel}
            </a>
        </div>
        `
        : '';

    const quoteBlock = quoteText
        ? `
        <div style="margin: 24px 0; padding: 16px 20px; border-left: 4px solid #ef4444; background-color: #fef2f2; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 14px; font-style: italic; color: #991b1b; line-height: 22px;">
                "${quoteText}"
            </p>
        </div>
        `
        : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="display: none; max-height: 0px; overflow: hidden;">
        ${previewText}
    </div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    <!-- Branded Header -->
                    <tr>
                        <td style="background-color: #1a365d; padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                                CUA Memo System
                            </h1>
                        </td>
                    </tr>
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 16px; font-size: 16px; font-weight: bold; color: #1e293b;">
                                Hello ${recipientName},
                            </p>
                            ${formattedParagraphs}
                            ${quoteBlock}
                            ${actionButton}
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0 24px;" />
                            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 18px;">
                                This is an automated email from the Cosmopolitan University Memo Tracking System. Please do not reply directly to this message.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Orchestrates email sending based on the memo's lifecycle updates.
 * Safely executes in the background and is non-blocking.
 */
export async function sendMemoNotificationEmail(
    memoId: number,
    eventType: 'SUBMITTED' | 'REJECTED' | 'APPROVED_BY_LM' | 'DISTRIBUTED' | 'RESUBMITTED',
    extraData?: {
        comments?: string;
    }
) {
    const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    try {
        console.log(`[Mailer] Processing notification email for memo ID ${memoId}, event: ${eventType}`);

        // 1. Fetch the memo and its creator details
        const memoRows = await query(`
            SELECT m.title, m.uuid, m.created_by,
                   u_creator.email as creator_email,
                   COALESCE(CONCAT(hs_creator.FirstName, ' ', IFNULL(CONCAT(hs_creator.MiddleName, ' '), ''), hs_creator.Surname), u_creator.username) as creator_name
            FROM memos m
            JOIN memo_system_users u_creator ON m.created_by = u_creator.id
            LEFT JOIN hr_staff hs_creator ON u_creator.staff_id = hs_creator.StaffID
            WHERE m.id = ?
            LIMIT 1
        `, [memoId]) as any[];

        if (memoRows.length === 0) {
            console.error(`[Mailer] Memo not found for ID ${memoId}`);
            return;
        }

        const memo = memoRows[0];
        const memoTitle = memo.title;
        const memoUuid = memo.uuid;
        const creatorEmail = memo.creator_email;
        const creatorName = memo.creator_name;
        const memoUrl = `${BASE_URL}/dashboard/memos/${memoUuid}`;

        if (eventType === 'SUBMITTED' || eventType === 'RESUBMITTED') {
            // Find the pending manager approval step
            const managerApprovalRows = await query(`
                SELECT a.approver_id, u_mgr.email as manager_email,
                       COALESCE(CONCAT(hs_mgr.FirstName, ' ', IFNULL(CONCAT(hs_mgr.MiddleName, ' '), ''), hs_mgr.Surname), u_mgr.username) as manager_name
                FROM memo_approvals a
                JOIN memo_system_users u_mgr ON a.approver_id = u_mgr.id
                LEFT JOIN hr_staff hs_mgr ON u_mgr.staff_id = hs_mgr.StaffID
                WHERE a.memo_id = ? AND a.step_order = 1 AND a.status = 'Pending'
                LIMIT 1
            `, [memoId]) as any[];

            if (managerApprovalRows.length === 0) {
                console.warn(`[Mailer] No pending line manager approval found for memo ID ${memoId}`);
                return;
            }

            const mgr = managerApprovalRows[0];
            const managerEmail = mgr.manager_email;
            const managerName = mgr.manager_name;

            const isResubmission = eventType === 'RESUBMITTED';
            const subject = isResubmission 
                ? `[CUA Memo] Action Required: Revised Memo Resubmitted - ${memoTitle}`
                : `[CUA Memo] Action Required: New Memo for Validation - ${memoTitle}`;
            
            const previewText = isResubmission
                ? `The revised memo "${memoTitle}" has been resubmitted for your review.`
                : `A new memo "${memoTitle}" requires your validation.`;

            const paragraphs = isResubmission
                ? [
                    `The revised memo titled "${memoTitle}" has been resubmitted by ${creatorName} for your review.`,
                    `Please check the updated content, corrections, and any attachment changes, then log in to proceed with your approval or rejection.`
                  ]
                : [
                    `A new memo titled "${memoTitle}" has been submitted by ${creatorName} and is pending your review.`,
                    `Please log in to Cosmopolitan University Memo System to approve or reject this submission.`
                  ];

            const html = getEmailTemplate({
                recipientName: managerName,
                title: subject,
                previewText,
                paragraphs,
                actionUrl: memoUrl,
                actionLabel: 'Review Memo'
            });

            const text = `${previewText}\n\nView it here: ${memoUrl}`;

            if (managerEmail) {
                await sendMemoEmail({ to: managerEmail, subject, bodyHtml: html, bodyText: text });
            }
        } 
        else if (eventType === 'REJECTED') {
            // Find the most recent rejected approval step to identify the rejector and get the comments
            const rejectionRows = await query(`
                SELECT a.comments,
                       COALESCE(CONCAT(hs_app.FirstName, ' ', IFNULL(CONCAT(hs_app.MiddleName, ' '), ''), hs_app.Surname), u_app.username) as rejector_name
                FROM memo_approvals a
                JOIN memo_system_users u_app ON a.approver_id = u_app.id
                LEFT JOIN hr_staff hs_app ON u_app.staff_id = hs_app.StaffID
                WHERE a.memo_id = ? AND a.status = 'Rejected'
                ORDER BY a.processed_at DESC
                LIMIT 1
            `, [memoId]) as any[];

            const comments = extraData?.comments || (rejectionRows.length > 0 ? rejectionRows[0].comments : 'No comments');
            const rejectorName = rejectionRows.length > 0 ? rejectionRows[0].rejector_name : 'Review Committee';

            const subject = `[CUA Memo] Action Required: Memo Rejected - ${memoTitle}`;
            const previewText = `Your memo "${memoTitle}" has been rejected.`;
            const paragraphs = [
                `Your memo titled "${memoTitle}" has been rejected by ${rejectorName}.`,
                `Based on this rejection, you are now permitted to edit and resubmit this memo. The reason provided is listed below:`
            ];

            const html = getEmailTemplate({
                recipientName: creatorName,
                title: subject,
                previewText,
                paragraphs,
                actionUrl: `${memoUrl}/edit`,
                actionLabel: 'Edit & Resubmit',
                quoteText: comments
            });

            const text = `${previewText}\nReason: "${comments}"\n\nEdit here: ${memoUrl}/edit`;

            if (creatorEmail) {
                await sendMemoEmail({ to: creatorEmail, subject, bodyHtml: html, bodyText: text });
            }
        } 
        else if (eventType === 'APPROVED_BY_LM') {
            // Find the line manager who approved
            const managerRows = await query(`
                SELECT COALESCE(CONCAT(hs_mgr.FirstName, ' ', IFNULL(CONCAT(hs_mgr.MiddleName, ' '), ''), hs_mgr.Surname), u_mgr.username) as manager_name
                FROM memo_system_users u_creator
                JOIN memo_system_users u_mgr ON u_creator.line_manager_id = u_mgr.id
                LEFT JOIN hr_staff hs_mgr ON u_mgr.staff_id = hs_mgr.StaffID
                WHERE u_creator.id = ?
                LIMIT 1
            `, [memo.created_by]) as any[];

            const managerName = managerRows.length > 0 ? managerRows[0].manager_name : 'Line Manager';

            const subject = `[CUA Memo] Update: Memo Approved by Line Manager - ${memoTitle}`;
            const previewText = `Your memo "${memoTitle}" has been approved by your Line Manager.`;
            const paragraphs = [
                `Your memo titled "${memoTitle}" has been approved by your Line Manager, ${managerName}.`,
                `It has now progressed to the next stage of approval and review in the sequential approval pipeline.`
            ];

            const html = getEmailTemplate({
                recipientName: creatorName,
                title: subject,
                previewText,
                paragraphs,
                actionUrl: memoUrl,
                actionLabel: 'View Memo Status'
            });

            const text = `${previewText}\n\nView here: ${memoUrl}`;

            if (creatorEmail) {
                await sendMemoEmail({ to: creatorEmail, subject, bodyHtml: html, bodyText: text });
            }
        } 
        else if (eventType === 'DISTRIBUTED') {
            // 1. Notify the Creator
            const creatorSubject = `[CUA Memo] Distributed: ${memoTitle}`;
            const creatorPreviewText = `Your memo "${memoTitle}" has been fully approved and distributed.`;
            const creatorParagraphs = [
                `Your memo titled "${memoTitle}" has been fully approved and distributed to all designated recipients.`
            ];
            
            const creatorHtml = getEmailTemplate({
                recipientName: creatorName,
                title: creatorSubject,
                previewText: creatorPreviewText,
                paragraphs: creatorParagraphs,
                actionUrl: memoUrl,
                actionLabel: 'View Memo'
            });

            const creatorText = `${creatorPreviewText}\n\nView here: ${memoUrl}`;

            if (creatorEmail) {
                await sendMemoEmail({ to: creatorEmail, subject: creatorSubject, bodyHtml: creatorHtml, bodyText: creatorText });
            }

            // 2. Notify all Recipients (To, CC, BCC)
            const recipientRows = await query(`
                SELECT mr.recipient_id, u_rec.email as recipient_email,
                       COALESCE(CONCAT(hs_rec.FirstName, ' ', IFNULL(CONCAT(hs_rec.MiddleName, ' '), ''), hs_rec.Surname), u_rec.username) as recipient_name
                FROM memo_recipients mr
                JOIN memo_system_users u_rec ON mr.recipient_id = u_rec.id
                LEFT JOIN hr_staff hs_rec ON u_rec.staff_id = hs_rec.StaffID
                WHERE mr.memo_id = ?
            `, [memoId]) as any[];

            for (const rec of recipientRows) {
                if (!rec.recipient_email) continue;

                const recipientSubject = `[CUA Memo] New Internal Memo: ${memoTitle}`;
                const recipientPreviewText = `A new internal memo "${memoTitle}" has been sent by ${creatorName}.`;
                const recipientParagraphs = [
                    `A new internal memo titled "${memoTitle}" has been sent to you by ${creatorName}.`,
                    `Please log in to Cosmopolitan University Memo System to view the contents of the memo and acknowledge receipt.`
                ];

                const recipientHtml = getEmailTemplate({
                    recipientName: rec.recipient_name,
                    title: recipientSubject,
                    previewText: recipientPreviewText,
                    paragraphs: recipientParagraphs,
                    actionUrl: memoUrl,
                    actionLabel: 'View Memo'
                });

                const recipientText = `${recipientPreviewText}\n\nView here: ${memoUrl}`;

                await sendMemoEmail({ to: rec.recipient_email, subject: recipientSubject, bodyHtml: recipientHtml, bodyText: recipientText });
            }
        }
    } catch (error) {
        console.error('[Mailer] sendMemoNotificationEmail error:', error);
    }
}
