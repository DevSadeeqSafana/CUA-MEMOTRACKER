import { query } from '@/lib/db';
import { UserFacingError } from '@/lib/errors';

// Vendors are shared with the Staff Portal: they live in its inventory_vendor table
// (vendor_id, vendor_name, description, address, phone_number, email_address,
// submitted_by / updated_by = staff IDs). The Memo app adds bank details and an
// active flag (migrations/20261125_memo_vendors.sql).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface VendorOption {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    isActive: boolean;
}

export interface VendorRecord extends VendorOption {
    description: string | null;
    createdBy: string | null;
    createdAt: string | null;
    updatedBy: string | null;
    updatedAt: string | null;
    memoCount: number;
}

export interface VendorInput {
    name?: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
}

/** Finance (Accountant), Administrators: register, edit and deactivate vendors. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canManageVendors(session: any) {
    const roles: string[] = session?.user?.role || [];
    return roles.includes('Accountant') || roles.includes('Administrator')
        || String(session?.user?.email || '').toLowerCase().includes('chidi.ojiako');
}

const staffName = (alias: string, col: string) =>
    `(SELECT COALESCE(CONCAT(h.FirstName, ' ', IFNULL(CONCAT(h.MiddleName, ' '), ''), h.Surname), ${alias}.${col})
        FROM hr_staff h WHERE h.StaffID = ${alias}.${col} LIMIT 1)`;

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export function toVendorOption(r: Row): VendorOption {
    return {
        id: Number(r.vendor_id),
        name: r.vendor_name || `Vendor #${r.vendor_id}`,
        email: r.email_address || null,
        phone: r.phone_number || null,
        address: r.address || null,
        bankName: r.bank_name || null,
        accountName: r.account_name || null,
        accountNumber: r.account_number || null,
        isActive: r.is_active === undefined ? true : Boolean(Number(r.is_active)),
    };
}

const OPTION_COLUMNS = `v.vendor_id, v.vendor_name, v.email_address, v.phone_number, v.address,
                        v.bank_name, v.account_name, v.account_number, v.is_active`;

export async function findVendorOptions(term: string, limit = 20): Promise<VendorOption[]> {
    const q = term.trim().slice(0, 100);
    const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    const rows = await query(`
        SELECT ${OPTION_COLUMNS}
        FROM inventory_vendor v
        WHERE v.is_active = 1
          AND (? = '' OR v.vendor_name LIKE ? OR v.email_address LIKE ? OR v.phone_number LIKE ?)
        ORDER BY (v.vendor_name LIKE ?) DESC, v.vendor_name ASC
        LIMIT ${Math.max(1, Math.min(50, Math.floor(limit)))}
    `, [q, like, like, like, `${q.replace(/[\\%_]/g, m => `\\${m}`)}%`]) as Row[];
    return rows.map(toVendorOption);
}

export async function getVendorOption(id: number): Promise<VendorOption | null> {
    if (!Number.isInteger(id) || id <= 0) return null;
    const rows = await query(`SELECT ${OPTION_COLUMNS} FROM inventory_vendor v WHERE v.vendor_id = ? LIMIT 1`, [id]) as Row[];
    return rows[0] ? toVendorOption(rows[0]) : null;
}

export async function listVendorRecords(opts: { search?: string; status?: 'active' | 'inactive' | 'all'; id?: number } = {}): Promise<VendorRecord[]> {
    const q = (opts.search || '').trim().slice(0, 100);
    const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    const status = opts.status || 'active';
    const rows = await query(`
        SELECT ${OPTION_COLUMNS}, v.description, v.submitted_date, v.updated_date,
               ${staffName('v', 'submitted_by')} AS created_by_name,
               ${staffName('v', 'updated_by')} AS updated_by_name,
               (SELECT COUNT(DISTINCT m.id) FROM memos m
                  LEFT JOIN memo_finance_processing fp ON fp.memo_id = m.id
                 WHERE m.vendor_id = v.vendor_id OR fp.vendor_id = v.vendor_id) AS memo_count
        FROM inventory_vendor v
        WHERE (? = 'all' OR (? = 'active' AND v.is_active = 1) OR (? = 'inactive' AND v.is_active = 0))
          AND (? = '' OR v.vendor_name LIKE ? OR v.email_address LIKE ? OR v.phone_number LIKE ? OR v.description LIKE ?)
          AND (? = 0 OR v.vendor_id = ?)
        ORDER BY v.vendor_name ASC
    `, [status, status, status, q, like, like, like, like, opts.id ?? 0, opts.id ?? 0]) as Row[];
    return rows.map(r => ({
        ...toVendorOption(r),
        description: r.description || null,
        createdBy: r.created_by_name || null,
        createdAt: iso(r.submitted_date),
        updatedBy: r.updated_by_name || null,
        updatedAt: iso(r.updated_date),
        memoCount: Number(r.memo_count) || 0,
    }));
}

/** A vendor ID from a form, checked against the vendor list. Returns null for "no vendor". */
/** `currentId`: the vendor already linked; it may stay linked even if Finance has since deactivated it. */
export async function resolveVendorId(raw: unknown, currentId?: number | null): Promise<number | null> {
    if (raw === null || raw === undefined || raw === '' || raw === 'null') return null;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return null;
    const v = await getVendorOption(id);
    if (!v) throw new VendorValidationError('The selected vendor no longer exists. Please choose another vendor.');
    if (!v.isActive && id !== Number(currentId)) throw new VendorValidationError(`${v.name} has been deactivated by Finance. Please choose another vendor.`);
    return id;
}

export class VendorValidationError extends UserFacingError {
    constructor(message: string) { super(message); this.name = 'VendorValidationError'; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,45}$/;

export interface CleanVendor {
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
}

/** Trims and checks vendor details. Throws VendorValidationError with a message for the user. */
export function cleanVendorInput(input: VendorInput): CleanVendor {
    const t = (v: unknown, max: number, label: string) => {
        const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
        if (s.length > max) throw new VendorValidationError(`${label} must be ${max} characters or fewer.`);
        return s || null;
    };
    const name = t(input.name, 145, 'Vendor name');
    if (!name || name.length < 2) throw new VendorValidationError('Enter the vendor name.');
    const email = t(input.email, 45, 'Email address')?.toLowerCase() ?? null;
    if (email && !EMAIL_RE.test(email)) throw new VendorValidationError('Enter a valid email address, or leave it blank.');
    const phone = t(input.phone, 45, 'Phone number');
    if (phone && !PHONE_RE.test(phone)) throw new VendorValidationError('Enter a valid phone number (digits, spaces, + and - only), or leave it blank.');
    const accountNumber = t(input.accountNumber, 20, 'Account number')?.replace(/\s/g, '') ?? null;
    if (accountNumber && !/^\d{10}$/.test(accountNumber)) throw new VendorValidationError('The account number must be exactly 10 digits.');
    const description = typeof input.description === 'string' ? input.description.trim().slice(0, 2000) || null : null;
    const address = typeof input.address === 'string' ? input.address.trim() : '';
    if (address.length > 500) throw new VendorValidationError('Address must be 500 characters or fewer.');
    return {
        name,
        description,
        address: address || null,
        phone,
        email,
        bankName: t(input.bankName, 120, 'Bank name'),
        accountName: t(input.accountName, 150, 'Account name'),
        accountNumber,
    };
}

/** Another vendor with the same name or email (case-insensitive), if any. */
export async function findDuplicateVendor(v: CleanVendor, excludeId?: number): Promise<VendorOption | null> {
    const rows = await query(`
        SELECT ${OPTION_COLUMNS} FROM inventory_vendor v
        WHERE (LOWER(TRIM(v.vendor_name)) = LOWER(?) OR (? IS NOT NULL AND LOWER(TRIM(v.email_address)) = ?))
          AND v.vendor_id <> ?
        LIMIT 1
    `, [v.name, v.email, v.email, excludeId ?? 0]) as Row[];
    return rows[0] ? toVendorOption(rows[0]) : null;
}
