'use server';

import { auth } from '@/auth';
import { query } from './db';
import { generateReferenceNumber } from './memo-utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function createMemo(data: FormData, isDraft: boolean) {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }

    const userId = session.user.id;

    // Extract fields from FormData
    const title = data.get('title') as string;
    const content = data.get('content') as string;
    const department = data.get('department') as string;
    const category = data.get('category') as string;
    const priority = data.get('priority') as string;
    const memo_type = data.get('memo_type') as string;
    const expiry_date = data.get('expiry_date') as string;
    const recipient_ids = JSON.parse(data.get('recipient_ids') as string || '[]');
    const files = data.getAll('attachments') as File[];

    const referenceNumber = await generateReferenceNumber(department);
    const status = isDraft ? 'Draft' : 'Line Manager Review';
    const uuid = crypto.randomUUID();

    try {
        const result = await query(
            `INSERT INTO memos 
      (uuid, reference_number, title, content, department, category, priority, memo_type, status, expiry_date, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                referenceNumber,
                title,
                content,
                department,
                category,
                priority || 'Medium',
                memo_type,
                status,
                expiry_date || null,
                userId
            ]
        ) as any;

        const memoId = result.insertId;

        // Handle Attachments
        if (files.length > 0) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads');
            try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

            for (const file of files) {
                if (!file || file.size === 0) continue;
                const buffer = Buffer.from(await file.arrayBuffer());
                const fileName = `${uuid}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
                const filePath = `/uploads/${fileName}`;

                await writeFile(path.join(uploadDir, fileName), buffer);

                await query(
                    'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
                    [memoId, file.name, filePath, file.type, file.size]
                );
            }
        }

        // Log the action
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, 'CREATE_MEMO', 'memos', memoId, JSON.stringify({ referenceNumber, status })]
        );

        // Insert recipients (Receivers)
        if (recipient_ids && recipient_ids.length > 0) {
            for (const recipientId of recipient_ids) {
                await query(
                    'INSERT IGNORE INTO memo_recipients (memo_id, recipient_id) VALUES (?, ?)',
                    [memoId, recipientId]
                );
            }
        }

        // Setup sequential approvals
        if (!isDraft) {
            const userRoles = (session.user as any).role || [];
            const isLineManager = userRoles.includes('Line Manager');

            let currentStep = 1;

            if (!isLineManager) {
                // Step 1: Hierarchical Line Manager
                const userResult = await query('SELECT staff_id FROM memo_system_users WHERE id = ?', [userId]) as any[];
                const staffId = userResult.length > 0 ? userResult[0].staff_id : null;

                if (staffId) {
                    // Check if user has an explicitly assigned line manager first
                    const assignedManagerResult = await query('SELECT line_manager_id FROM memo_system_users WHERE staff_id = ?', [staffId]) as any[];
                    let managerId = assignedManagerResult.length > 0 ? assignedManagerResult[0].line_manager_id : null;

                    // If no explicit mapping, fallback to hr_staff table lookup
                    if (!managerId) {
                        const hrResult = await query('SELECT LineManagerID FROM hr_staff WHERE StaffID = ?', [staffId]) as any[];
                        const hrManagerId = hrResult.length > 0 ? hrResult[0].LineManagerID : null;

                        if (hrManagerId) {
                            const systemManager = await query('SELECT id FROM memo_system_users WHERE staff_id = ?', [hrManagerId]) as any[];
                            managerId = systemManager.length > 0 ? systemManager[0].id : null;
                        }
                    }

                    if (managerId) {
                        await query(
                            'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                            [memoId, managerId, currentStep++, 'Pending']
                        );
                    }
                }
            }

            // Step 2 (Final Decision Maker): Global Reviewer or Admin
            // If it's an Approval memo, we MUST have a final decision maker
            if (memo_type === 'Approval') {
                const reviewers = await query(`
                    SELECT u.id FROM memo_system_users u 
                    JOIN user_roles ur ON u.id = ur.user_id 
                    JOIN roles r ON ur.role_id = r.id 
                    WHERE r.name = 'Reviewer' LIMIT 1`
                ) as any[];

                if (reviewers.length > 0) {
                    await query(
                        'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                        [memoId, reviewers[0].id, currentStep++, 'Pending']
                    );
                }
            }

            // Determine initial status based on who needs to act first
            const firstStep = await query(
                'SELECT approver_id FROM memo_approvals WHERE memo_id = ? ORDER BY step_order ASC LIMIT 1',
                [memoId]
            ) as any[];

            if (firstStep.length > 0) {
                const targetStatus = !isLineManager ? 'Line Manager Review' : 'Reviewer Approval';
                await query('UPDATE memos SET status = ? WHERE id = ?', [targetStatus, memoId]);

                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [firstStep[0].approver_id, memoId, `A new memo "${title}" requires your review.`]
                );
            } else {
                // No approvals needed? (Unlikely for CUA records)
                await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);
            }
        }

        revalidatePath('/dashboard');
        return { success: true, memoId, memoUuid: uuid };
    } catch (error) {
        console.error('Database Error:', error);
        return { success: false, error: 'Failed to create memo.' };
    }
}

export async function approveMemo(memoId: number, approvalId: number) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        // Mark current step as approved
        await query(
            'UPDATE memo_approvals SET status = "Approved", processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [approvalId]
        );

        // Find the next sequential step
        const nextSteps = await query(
            'SELECT id, approver_id FROM memo_approvals WHERE memo_id = ? AND status = "Pending" ORDER BY step_order ASC LIMIT 1',
            [memoId]
        ) as any[];

        if (nextSteps.length > 0) {
            // Move to next approver
            await query('UPDATE memos SET status = "Reviewer Approval" WHERE id = ?', [memoId]);

            const memoDetails = await query(`
                SELECT m.title, u.username as creator_name
                FROM memos m
                JOIN memo_system_users u ON m.created_by = u.id
                WHERE m.id = ?`, [memoId]) as any[];

            const message = `${memoDetails[0].creator_name}'s memo "${memoDetails[0].title}" has been reviewed. Your final decision is required.`;

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [nextSteps[0].approver_id, memoId, message]
            );
        } else {
            // Final approval complete: Distribute
            await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);
            const memo = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [memo[0].created_by, memoId, `Your memo "${memo[0].title}" has been fully approved and distributed.`]
            );

            // Notify all recipients
            const recipients = await query('SELECT recipient_id FROM memo_recipients WHERE memo_id = ?', [memoId]) as any[];
            for (const recipient of recipients) {
                await query(
                    'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                    [recipient.recipient_id, memoId, `New internal memo: "${memo[0].title}" has been distributed.`]
                );
            }
        }

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
            [session.user.id, 'APPROVE_MEMO', 'memo_approvals', approvalId]
        );

        revalidatePath(`/dashboard/memos/${memoId}`);
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/approvals');
        return { success: true };
    } catch (error) {
        console.error('Approval Error:', error);
        return { success: false };
    }
}

export async function rejectMemo(memoId: number, approvalId: number, comments?: string) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        await query(
            'UPDATE memo_approvals SET status = "Rejected", comments = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [comments || 'No comments', approvalId]
        );

        await query('UPDATE memos SET status = "Draft" WHERE id = ?', [memoId]);

        const memo = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];
        await query(
            'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
            [memo[0].created_by, memoId, `Your memo "${memo[0].title}" was rejected by the review committee.`]
        );

        revalidatePath(`/dashboard/memos/${memoId}`);
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Rejection Error:', error);
        return { success: false };
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

export async function acknowledgeMemo(memoId: number) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        await query(
            'UPDATE memo_recipients SET acknowledged_at = CURRENT_TIMESTAMP WHERE memo_id = ? AND recipient_id = ?',
            [memoId, session.user.id]
        );

        // Always notify the sender when any recipient acknowledges
        const memoRows = await query('SELECT created_by, title, uuid FROM memos WHERE id = ?', [memoId]) as any[];
        if (memoRows.length > 0) {
            const memo = memoRows[0];
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [memo.created_by, memoId, `${session.user.name} has acknowledged your memo "${memo.title}".`]
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
        const managers = await query(`
            SELECT u.id, u.username, u.department 
            FROM memo_system_users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'Line Manager'
        `) as any[];
        return managers;
    } catch (error) {
        console.error('Failed to fetch managers:', error);
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

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error('Toggle status error:', error);
        return { success: false };
    }
}

export async function getRecipients() {
    try {
        const recipients = await query(`
            SELECT u.id, u.username, u.department 
            FROM memo_system_users u
            WHERE u.is_active = 1
        `) as any[];
        return recipients;
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
