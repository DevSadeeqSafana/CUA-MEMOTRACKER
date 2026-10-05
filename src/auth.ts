import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { query } from './lib/db';
import crypto from 'crypto';

type QueryRow = Record<string, unknown>;
type UserRecord = QueryRow & {
    id?: number;
    email?: string;
    is_active?: number | boolean;
    department?: string;
    password_hash?: string;
    full_name?: string;
};

async function getUser(email: string): Promise<UserRecord | undefined> {
    try {
        const users = await query(`
            SELECT u.*, COALESCE(CONCAT(hs.FirstName, ' ', IFNULL(CONCAT(hs.MiddleName, ' '), ''), hs.Surname), u.username) as full_name
            FROM memo_system_users u
            LEFT JOIN hr_staff hs ON u.staff_id = hs.StaffID
            WHERE u.email = ?
        `, [email]) as QueryRow[];
        return users[0] as UserRecord | undefined;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

type GoogleProfile = { email: string; hd?: string; name?: string };

// Google checks the access token for us: tokeninfo rejects forged or expired
// tokens, and the audience check rejects tokens issued to other apps.
async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleProfile | null> {
    try {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
            console.error('Google SSO: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
            return null;
        }

        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
        if (!tokenInfoRes.ok) return null;
        const tokenInfo = await tokenInfoRes.json();
        if (tokenInfo.aud !== clientId) {
            console.error('Google SSO: access token was issued to a different client');
            return null;
        }

        const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) return null;
        const userInfo = await userInfoRes.json();
        if (!userInfo.email || userInfo.email_verified !== true) return null;

        return { email: userInfo.email, hd: userInfo.hd, name: userInfo.name };
    } catch (e) {
        console.error('Failed to verify Google access token:', e);
        return null;
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                // 1. Google SSO Authorization Flow
                if (credentials?.googleAccessToken && typeof credentials.googleAccessToken === 'string') {
                    const payload = await verifyGoogleAccessToken(credentials.googleAccessToken);
                    if (!payload) {
                        console.error('Google SSO: Invalid or unverified Google access token');
                        return null;
                    }

                    const allowedDomain = (process.env.GOOGLE_ALLOWED_DOMAIN || 'cosmopolitan.edu.ng').toLowerCase();
                    const userDomain = payload.hd ? payload.hd.toLowerCase() : '';
                    const emailDomain = payload.email.includes('@') ? payload.email.split('@')[1].toLowerCase() : '';

                    if (userDomain !== allowedDomain && emailDomain !== allowedDomain) {
                        console.error(`Google SSO Rejected: Email ${payload.email} is not from allowed domain ${allowedDomain}`);
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
                            `, [payload.email]) as QueryRow[];

                            if (staffRows.length > 0) {
                                const staff = staffRows[0] as QueryRow & {
                                    StaffID?: number;
                                    DepartmentCode?: string;
                                    LineManagerID?: number | null;
                                };
                                const uuid = crypto.randomUUID();
                                const username = payload.email.split('@')[0];
                                const ssoPlaceholderHash = '$2a$10$google_sso_managed_account_no_local_pass';

                                const insertResult = await query(
                                    'INSERT INTO memo_system_users (uuid, staff_id, username, email, password_hash, department, line_manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                                    [uuid, staff.StaffID, username, payload.email, ssoPlaceholderHash, staff.DepartmentCode || 'General', staff.LineManagerID || null]
                                ) as { insertId: number };

                                const newUserId = insertResult.insertId;
                                const roleRows = await query("SELECT id FROM roles WHERE name = 'Initiator'", []) as QueryRow[];
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
                        WHERE ur.user_id = ?`, [user.id]) as QueryRow[];

                    return {
                        id: String(user.id),
                        email: user.email,
                        name: user.full_name || payload.name,
                        department: user.department,
                        role: roles.map(r => String(r.name)),
                    };
                }

                console.log('Google SSO credentials were not provided');
                return null;
            },
        }),
    ],
});
