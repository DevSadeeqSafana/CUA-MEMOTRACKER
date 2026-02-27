'use server';

import { auth } from '@/auth';
import { query } from './db';
import { generateReferenceNumber } from './memo-utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
    const category = data.get('category') as string;
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
    const files = data.getAll('attachments') as File[];

    console.log(`createMemo: User ${userId} is creating a "${title}" memo (isDraft: ${isDraft})`);

    try {
        const referenceNumber = await generateReferenceNumber(department);
        const status = isDraft ? 'Draft' : 'Line Manager Review';
        const uuid = crypto.randomUUID();

        // 1. Insert Core Memo
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
                priority,
                memo_type,
                status,
                expiry_date || null,
                userId
            ]
        ) as any;

        const memoId = result.insertId;
        console.log(`createMemo: Memo inserted with ID ${memoId}`);

        // 2. Handle Budget Info
        if (is_budget_memo) {
            await query(
                `INSERT INTO memo_budget_info 
                 (memo_id, year_id, budget_category, other_category) 
                 VALUES (?, ?, ?, ?)`,
                [memoId, year_id, budget_category, other_category]
            );

            for (const item of budget_items) {
                const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.amount) || 0);
                await query(
                    `INSERT INTO memo_budget_items 
                     (memo_id, name, description, quantity, amount, total) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [memoId, item.name, item.description || '', item.quantity || 1, item.amount || 0, subtotal]
                );
            }
        }

        // 3. Handle Attachments
        if (files.length > 0) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads');
            try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

            for (const file of files) {
                if (!file || file.size === 0 || typeof file === 'string') continue;
                const buffer = Buffer.from(await (file as File).arrayBuffer());
                const fileName = `${uuid}-${Date.now()}-${(file as File).name.replace(/\s+/g, '_')}`;
                const filePath = `/uploads/${fileName}`;

                await writeFile(path.join(uploadDir, fileName), buffer);

                await query(
                    'INSERT INTO attachments (memo_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
                    [memoId, (file as File).name, filePath, (file as File).type, (file as File).size]
                );
            }
        }

        // 4. Log the action
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, 'CREATE_MEMO', 'memos', memoId, JSON.stringify({ referenceNumber, status })]
        );

        // 5. Insert recipients
        if (recipient_ids && recipient_ids.length > 0) {
            for (const recipientId of recipient_ids) {
                await query(
                    'INSERT IGNORE INTO memo_recipients (memo_id, recipient_id) VALUES (?, ?)',
                    [memoId, recipientId]
                );
            }
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
            } else {
                await query('UPDATE memos SET status = "Distributed" WHERE id = ?', [memoId]);
            }
        }

        console.log(`createMemo: Finished successfully for memo ${uuid}`);
        revalidatePath('/dashboard');
        return { success: true, memoId, memoUuid: uuid };
    } catch (error: any) {
        console.error('createMemo Error:', error);
        return { success: false, error: error.message || 'Failed to create memo.' };
    }
}

export async function approveMemo(memoId: number, approvalId: number, comments: string = '') {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        // Mark current step as approved with optional comments
        await query(
            'UPDATE memo_approvals SET status = "Approved", comments = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [comments, approvalId]
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
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, 'APPROVE_MEMO', 'memo_approvals', approvalId, JSON.stringify({ comments })]
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

        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [session.user.id, 'REJECT_MEMO', 'memo_approvals', approvalId, JSON.stringify({ comments })]
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

export async function acknowledgeMemo(memoId: number, decision: 'Acknowledged' | 'Approved' | 'Rejected' = 'Acknowledged') {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    try {
        await query(
            'UPDATE memo_recipients SET acknowledged_at = CURRENT_TIMESTAMP, decision = ? WHERE memo_id = ? AND recipient_id = ?',
            [decision, memoId, session.user.id]
        );

        // Always notify the sender when any recipient acts on it
        const memoRows = await query('SELECT created_by, title, uuid FROM memos WHERE id = ?', [memoId]) as any[];
        if (memoRows.length > 0) {
            const memo = memoRows[0];
            const actionText = decision === 'Acknowledged' ? 'acknowledged' : decision.toLowerCase();
            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [memo.created_by, memoId, `${session.user.name} has ${actionText} your memo "${memo.title}".`]
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
            SELECT DISTINCT u.id, u.username, u.department, u.staff_id
            FROM memo_system_users u
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
        const { unstable_cache } = require('next/cache');
        const fetchRecipients = unstable_cache(
            async () => {
                const recipients = await query(`
                    SELECT u.id, u.username, u.department 
                    FROM memo_system_users u
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

export async function getBudgetItemNames() {
    try {
        const { unstable_cache } = require('next/cache');
        const getNames = unstable_cache(
            async () => {
                const results = await query(`
                    SELECT ItemName, MAX(Quantity) as Quantity, MAX(Amount) as Amount
                    FROM hr_finance_budget_item 
                    WHERE ItemName IS NOT NULL AND ItemName != ''
                    GROUP BY ItemName
                    ORDER BY ItemName ASC
                `) as any[];
                return results.map(r => ({
                    name: r.ItemName,
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

    try {
        const userId = parseInt(session.user.id);

        // Verify the user is a current pending approver for this memo
        const pendingApprovals = await query(
            'SELECT id FROM memo_approvals WHERE memo_id = ? AND approver_id = ? AND status = "Pending"',
            [memoId, userId]
        ) as any[];

        if (pendingApprovals.length === 0) {
            throw new Error('Only the current pending approver can modify routing.');
        }

        // 0. Fetch pre-change state for detailed logging
        const originalRecipients = await query(
            `SELECT u.username FROM memo_recipients mr JOIN memo_system_users u ON mr.recipient_id = u.id WHERE mr.memo_id = ?`,
            [memoId]
        ) as any[];
        const oldRecipientNames = originalRecipients.map(r => r.username);

        // 1. Update Recipients
        await query('DELETE FROM memo_recipients WHERE memo_id = ?', [memoId]);

        const newRecipientResults: string[] = [];
        for (const rid of recipientIds) {
            await query(
                'INSERT INTO memo_recipients (memo_id, recipient_id) VALUES (?, ?)',
                [memoId, rid]
            );
            const user = await query('SELECT username FROM memo_system_users WHERE id = ?', [rid]) as any[];
            if (user.length > 0) newRecipientResults.push(user[0].username);
        }

        // Calculate deltas
        const addedRecipients = newRecipientResults.filter(r => !oldRecipientNames.includes(r)).join(', ');
        const removedRecipients = oldRecipientNames.filter(r => !newRecipientResults.includes(r)).join(', ');

        // 2. Add Additional Approvers
        const currentStepResult = await query(
            'SELECT step_order FROM memo_approvals WHERE id = ?',
            [pendingApprovals[0].id]
        ) as any[];

        let nextStepOrder = currentStepResult[0].step_order + 1;

        if (additionalApprovers.length > 0) {
            await query(
                'UPDATE memo_approvals SET step_order = step_order + ? WHERE memo_id = ? AND step_order >= ?',
                [additionalApprovers.length, memoId, nextStepOrder]
            );

            for (const approver of additionalApprovers) {
                await query(
                    'INSERT INTO memo_approvals (memo_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                    [approver.id, memoId, nextStepOrder++, 'Pending']
                );
            }
        }

        const approverNames = additionalApprovers.map(a => a.name).join(', ');

        const newRecipientNames = newRecipientResults.join(', ');
        const oldRecipientNamesString = oldRecipientNames.join(', ');

        // Log the action with rich details
        await query(
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
                    newRecipients: newRecipientNames
                })
            ]
        );

        // Create notification for the creator
        const memoRows = await query('SELECT created_by, title FROM memos WHERE id = ?', [memoId]) as any[];
        if (memoRows.length > 0) {
            const creatorId = memoRows[0].created_by;
            let message = `${session.user.name} has adjusted the routing for your memo "${memoRows[0].title}".`;

            if (oldRecipientNamesString && newRecipientNames && oldRecipientNamesString !== newRecipientNames) {
                message += ` Recipient changed from ${oldRecipientNamesString} to ${newRecipientNames}.`;
            } else if (addedRecipients) {
                message += ` Added recipients: ${addedRecipients}.`;
            }

            if (approverNames) {
                message += ` Added ${approverNames} as an approver.`;
            }

            await query(
                'INSERT INTO notifications (user_id, memo_id, message) VALUES (?, ?, ?)',
                [creatorId, memoId, message]
            );
        }

        revalidatePath(`/dashboard/memos/${memoId}`);
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error: any) {
        console.error('Update Routing Error:', error);
        return { success: false, error: error.message || 'Failed to update routing.' };
    }
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
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
    const fromUserId = parseInt(session.user.id);

    try {
        const result = await query(
            `INSERT INTO memo_consultations (memo_id, from_user_id, to_user_id, message, parent_id, type)
             VALUES (?, ?, ?, ?, ?, 'Forward')`,
            [memoId, fromUserId, toUserId, message, parentId]
        ) as any;

        const consultationId = result.insertId;

        // Fetch memo title and sender name for notifications
        const memoRows = await query(
            `SELECT m.title, m.uuid, u.username as sender_name 
             FROM memos m JOIN memo_system_users u ON m.created_by = u.id 
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
        return { success: false, error: error.message || 'Failed to forward.' };
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
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
    const fromUserId = parseInt(session.user.id);

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
        return { success: false, error: error.message || 'Failed to respond.' };
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
                fu.username as from_name,
                tu.username as to_name
             FROM memo_consultations mc
             JOIN memo_system_users fu ON mc.from_user_id = fu.id
             JOIN memo_system_users tu ON mc.to_user_id = tu.id
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

/**
 * Search all active users (for the forward-to selector).
 */
export async function searchUsersForConsultation(searchTerm: string) {
    const session = await auth();
    if (!session?.user?.id) return [];
    const currentUserId = parseInt(session.user.id);

    try {
        const users = await query(
            `SELECT id, username, department 
             FROM memo_system_users 
             WHERE is_active = 1 AND id != ? AND (username LIKE ? OR department LIKE ?)
             LIMIT 20`,
            [currentUserId, `%${searchTerm}%`, `%${searchTerm}%`]
        ) as any[];
        return users;
    } catch (error: any) {
        console.error('Search users for consultation error:', error);
        return [];
    }
}
