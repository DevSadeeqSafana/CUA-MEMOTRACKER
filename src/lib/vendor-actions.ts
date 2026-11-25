'use server';

import { auth } from '@/auth';
import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { friendlyError, NOT_AUTHORIZED_MESSAGE } from '@/lib/errors';
import {
    canManageVendors, cleanVendorInput, findDuplicateVendor, findVendorOptions, getVendorOption,
    VendorValidationError, type VendorInput, type VendorOption,
} from '@/lib/vendor-data';

type VendorResult =
    | { success: true; vendor: VendorOption }
    | { success: false; error: string; existing?: VendorOption };

async function currentStaffId(userId: number): Promise<string | null> {
    const rows = await query('SELECT staff_id FROM memo_system_users WHERE id = ? LIMIT 1', [userId]) as { staff_id: string }[];
    return rows[0]?.staff_id || null;
}

async function logVendorAction(userId: number, action: string, vendorId: number, value: object) {
    try {
        await query(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
            [userId, action, 'inventory_vendor', vendorId, JSON.stringify(value)]
        );
    } catch (e) {
        console.error('logVendorAction failed:', e);
    }
}

function vendorError(e: unknown, fallback: string) {
    if (e instanceof VendorValidationError) return e.message;
    console.error('Vendor action error:', e);
    return friendlyError(e, fallback);
}

/** Vendor picker on the memo form and finance queue: active vendors matching the search. */
export async function searchVendors(term: string): Promise<VendorOption[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    try {
        return await findVendorOptions(typeof term === 'string' ? term : '');
    } catch (e) {
        console.error('searchVendors error:', e);
        return [];
    }
}

export async function getVendorById(id: number): Promise<VendorOption | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    return getVendorOption(Number(id));
}

/**
 * Registers a vendor. Any signed-in user may add one from the memo form when the
 * vendor is not listed yet; Finance manages the record afterwards. Bank details are
 * only saved when Finance adds the vendor.
 */
export async function createVendor(input: VendorInput): Promise<VendorResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);
    const manager = canManageVendors(session);
    try {
        const v = cleanVendorInput(input);
        if (!manager) { v.bankName = null; v.accountName = null; v.accountNumber = null; }
        const dup = await findDuplicateVendor(v);
        if (dup) {
            return {
                success: false,
                existing: dup.isActive ? dup : undefined,
                error: dup.isActive
                    ? `${dup.name} is already registered${dup.email ? ` (${dup.email})` : ''}. Select it from the list instead.`
                    : `${dup.name} is already registered but has been deactivated. Ask Finance to reactivate it.`,
            };
        }
        const staffId = await currentStaffId(userId);
        const result = await query(
            `INSERT INTO inventory_vendor
               (vendor_name, description, address, phone_number, email_address, bank_name, account_name, account_number,
                is_active, submitted_by, updated_by, submitted_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW())`,
            [v.name, v.description, v.address, v.phone, v.email, v.bankName, v.accountName, v.accountNumber, staffId, staffId]
        ) as { insertId: number };
        const id = Number(result.insertId);
        await logVendorAction(userId, 'CREATE_VENDOR', id, { name: v.name, email: v.email, phone: v.phone });
        revalidatePath('/dashboard/vendors');
        const vendor = await getVendorOption(id);
        return vendor ? { success: true, vendor } : { success: false, error: 'The vendor was saved but could not be loaded. Refresh the page.' };
    } catch (e) {
        return { success: false, error: vendorError(e, "We couldn't register the vendor. Please try again.") };
    }
}

/** Finance only: update a vendor's details. */
export async function updateVendor(id: number, input: VendorInput): Promise<VendorResult> {
    const session = await auth();
    if (!session?.user?.id || !canManageVendors(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);
    try {
        const before = await getVendorOption(Number(id));
        if (!before) return { success: false, error: 'This vendor no longer exists. Refresh the page.' };
        const v = cleanVendorInput(input);
        const dup = await findDuplicateVendor(v, before.id);
        if (dup) return { success: false, error: `Another vendor (${dup.name}) already uses this name or email address.` };
        const staffId = await currentStaffId(userId);
        await query(
            `UPDATE inventory_vendor
                SET vendor_name = ?, description = ?, address = ?, phone_number = ?, email_address = ?,
                    bank_name = ?, account_name = ?, account_number = ?, updated_by = ?, updated_date = NOW()
              WHERE vendor_id = ?`,
            [v.name, v.description, v.address, v.phone, v.email, v.bankName, v.accountName, v.accountNumber, staffId, before.id]
        );
        const changed = (Object.keys(v) as (keyof typeof v)[]).filter(k => k !== 'description' && (before as unknown as Record<string, unknown>)[k] !== v[k]);
        await logVendorAction(userId, 'UPDATE_VENDOR', before.id, { name: v.name, changed });
        revalidatePath('/dashboard/vendors');
        const vendor = await getVendorOption(before.id);
        return { success: true, vendor: vendor! };
    } catch (e) {
        return { success: false, error: vendorError(e, "We couldn't update the vendor. Please try again.") };
    }
}

/** Finance only: deactivate (hide from pickers) or reactivate a vendor. Vendors are never deleted. */
export async function setVendorActive(id: number, active: boolean): Promise<VendorResult> {
    const session = await auth();
    if (!session?.user?.id || !canManageVendors(session)) return { success: false, error: NOT_AUTHORIZED_MESSAGE };
    const userId = parseInt(session.user.id);
    try {
        const before = await getVendorOption(Number(id));
        if (!before) return { success: false, error: 'This vendor no longer exists. Refresh the page.' };
        const staffId = await currentStaffId(userId);
        await query('UPDATE inventory_vendor SET is_active = ?, updated_by = ?, updated_date = NOW() WHERE vendor_id = ?',
            [active ? 1 : 0, staffId, before.id]);
        await logVendorAction(userId, active ? 'REACTIVATE_VENDOR' : 'DEACTIVATE_VENDOR', before.id, { name: before.name });
        revalidatePath('/dashboard/vendors');
        return { success: true, vendor: { ...before, isActive: active } };
    } catch (e) {
        return { success: false, error: vendorError(e, "We couldn't change the vendor's status. Please try again.") };
    }
}
