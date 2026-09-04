import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { query } from './lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';

async function getUser(email: string) {
    try {
        const users = await query(`
            SELECT u.*, COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
            FROM memo_system_users u
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            WHERE u.email = ?
        `, [email]) as any[];
        return users[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

function parseGoogleJwt(token: string) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to parse Google JWT:', e);
        return null;
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                // 1. Google SSO Authorization Flow
                if (credentials?.googleToken && typeof credentials.googleToken === 'string') {
                    const payload = parseGoogleJwt(credentials.googleToken);
                    if (!payload || !payload.email) {
                        console.error('Google SSO: Invalid ID token payload');
                        return null;
                    }

                    const allowedDomain = (process.env.GOOGLE_ALLOWED_DOMAIN || 'cosmopolitan.edu.ng').toLowerCase();
                    const userDomain = payload.hd ? payload.hd.toLowerCase() : '';
                    const emailDomain = payload.email.includes('@') ? payload.email.split('@')[1].toLowerCase() : '';

                    if (userDomain !== allowedDomain && emailDomain !== allowedDomain) {
                        console.error(`Google SSO Rejected: Email ${payload.email} is not from allowed domain ${allowedDomain}`);
                        return null;
                    }

                    if (payload.exp && payload.exp * 1000 < Date.now()) {
                        console.error('Google SSO: ID Token has expired');
                        return null;
                    }

                    let user = await getUser(payload.email);

                    // Auto-provision if user exists in active hr_staff but not yet in memo_system_users
                    if (!user) {
                        try {
                            const staffRows = await query(`
                                SELECT StaffID, FirstName, Surname, DepartmentCode, LineManagerID
                                FROM hr_staff
                                WHERE OfficialEmailAddress = ? AND IsActive = 1
                            `, [payload.email]) as any[];

                            if (staffRows.length > 0) {
                                const staff = staffRows[0];
                                const uuid = crypto.randomUUID();
                                const username = payload.email.split('@')[0];
                                const ssoPlaceholderHash = '$2a$10$google_sso_managed_account_no_local_pass';

                                const insertResult = await query(
                                    'INSERT INTO memo_system_users (uuid, staff_id, username, email, password_hash, department, line_manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                                    [uuid, staff.StaffID, username, payload.email, ssoPlaceholderHash, staff.DepartmentCode || 'General', staff.LineManagerID || null]
                                ) as any;

                                const newUserId = insertResult.insertId;
                                const roleRows = await query("SELECT id FROM roles WHERE name = 'Initiator'", []) as any[];
                                if (roleRows.length > 0) {
                                    await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [newUserId, roleRows[0].id]);
                                }

                                user = await getUser(payload.email);
                            }
                        } catch (err) {
                            console.error('Error auto-provisioning Google SSO user:', err);
                        }
                    }

                    if (!user) {
                        console.error(`Google SSO: User ${payload.email} not found in memo system or active HR records.`);
                        return null;
                    }

                    if (user.is_active === 0 || user.is_active === false) {
                        console.error(`Google SSO: Account for ${payload.email} is inactive.`);
                        return null;
                    }

                    const roles = await query(`
                        SELECT r.name 
                        FROM roles r 
                        JOIN user_roles ur ON r.id = ur.role_id 
                        WHERE ur.user_id = ?`, [user.id]) as any[];

                    return {
                        id: user.id.toString(),
                        email: user.email,
                        name: user.full_name || payload.name,
                        department: user.department,
                        role: roles.map(r => r.name),
                    };
                }

                // 2. Standard Email & Password Credentials Authorization Flow
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;
                    if (user.is_active === 0 || user.is_active === false) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password_hash);

                    if (passwordsMatch) {
                        const roles = await query(`
                            SELECT r.name 
                            FROM roles r 
                            JOIN user_roles ur ON r.id = ur.role_id 
                            WHERE ur.user_id = ?`, [user.id]) as any[];

                        return {
                            id: user.id.toString(),
                            email: user.email,
                            name: user.full_name,
                            department: user.department,
                            role: roles.map(r => r.name),
                        };
                    }
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
