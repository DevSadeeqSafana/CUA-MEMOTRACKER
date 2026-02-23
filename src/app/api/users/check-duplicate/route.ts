import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const staff_id = searchParams.get('staff_id');
    const email = searchParams.get('email');

    if (!staff_id && !email) {
        return NextResponse.json({ exists: false });
    }

    try {
        const rows = await query(
            `SELECT u.id, u.username, u.is_active, 
                    GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') as roles_list
             FROM memo_system_users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE u.staff_id = ? OR u.email = ?
             GROUP BY u.id
             LIMIT 1`,
            [staff_id, email]
        ) as any[];

        if (rows.length === 0) {
            return NextResponse.json({ exists: false });
        }

        const user = rows[0];
        return NextResponse.json({
            exists: true,
            status: user.is_active ? 'Active' : 'Inactive',
            roles: user.roles_list || 'No roles assigned',
            username: user.username
        });
    } catch (error) {
        console.error('Duplicate check error:', error);
        return NextResponse.json({ exists: false });
    }
}
