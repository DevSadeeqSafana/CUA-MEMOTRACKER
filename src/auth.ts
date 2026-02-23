import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { query } from './lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

async function getUser(email: string) {
    try {
        const users = await query('SELECT * FROM memo_system_users WHERE email = ?', [email]) as any[];
        return users[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;
                    const passwordsMatch = await bcrypt.compare(password, user.password_hash);

                    if (passwordsMatch) {
                        // Fetch roles for the user
                        const roles = await query(`
              SELECT r.name 
              FROM roles r 
              JOIN user_roles ur ON r.id = ur.role_id 
              WHERE ur.user_id = ?`, [user.id]) as any[];

                        return {
                            id: user.id.toString(),
                            email: user.email,
                            name: user.username,
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
