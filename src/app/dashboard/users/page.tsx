export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
    Users as UsersIcon,
    Search,
    Building,
    Mail,
    Filter,
    Activity
} from 'lucide-react';
import CreateUserFormWrapper from '@/components/users/CreateUserFormWrapper';
import UserTableActions from '@/components/users/UserTableActions';
import { cn } from '@/lib/utils';
import { getManagers } from '@/lib/actions';
import UserSearch from '@/components/users/UserSearch';

export default async function UserManagementPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const session = await auth();
    if (!session?.user || !(session.user as any).role?.includes('Administrator')) {
        return (
            <div className="p-20 text-center">
                <h2 className="text-2xl font-bold text-red-600">Unauthorized Access</h2>
                <p className="text-slate-500">You do not have permission to view the user directory.</p>
            </div>
        );
    }

    const queryStr = q ? `%${q}%` : null;

    // Fetch live users from database with manager names and active status
    const users = await query(`
        SELECT u.id, u.uuid, u.username, u.email, u.department, u.is_active, u.staff_id, u.line_manager_id,
               COALESCE(m_mgr_explicit.username, m_mgr_hr.username) as manager_name,
               GROUP_CONCAT(r.name) as roles_list
        FROM memo_system_users u
        LEFT JOIN hr_staff hr ON u.staff_id = hr.StaffID
        LEFT JOIN memo_system_users m_mgr_hr ON hr.LineManagerID = m_mgr_hr.staff_id
        LEFT JOIN memo_system_users m_mgr_explicit ON u.line_manager_id = m_mgr_explicit.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE (? IS NULL OR u.username LIKE ? OR u.email LIKE ? OR u.staff_id LIKE ?)
        GROUP BY u.id, u.uuid, u.username, u.email, u.department, u.is_active, u.staff_id, u.line_manager_id, manager_name
        ORDER BY u.created_at DESC
    `, [queryStr, queryStr, queryStr, queryStr]) as any[];

    const formattedUsers = users.map(u => ({
        ...u,
        roles: u.roles_list ? u.roles_list.split(',') : [],
        is_active: u.is_active === 1 || u.is_active === true
    }));

    const managers = await getManagers();

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1a365d] flex items-center justify-center border border-blue-100">
                            <UsersIcon size={18} />
                        </div>
                        <h1 className="text-xl font-black tracking-tight text-[#1a365d] font-outfit">User Directory</h1>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium ml-[44px]">Manage institutional accounts and system permissions.</p>
                </div>

                <CreateUserFormWrapper />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <UserSearch />
                <button className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all shadow-sm">
                    <Filter size={18} />
                    Filters
                </button>
            </div>

            {/* Table Interface */}
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden text-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">Staff Identity</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">University Email</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">Department</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">Reporting To</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">Status</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">System Roles</th>
                                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right bg-slate-50">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {formattedUsers.map((user) => (
                                <tr key={user.id} className={cn(
                                    "group hover:bg-slate-50/50 transition-colors",
                                    !user.is_active && "opacity-60 bg-slate-50/30"
                                )}>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                                                user.is_active ? "bg-[#1a365d] text-white" : "bg-slate-200 text-slate-500"
                                            )}>
                                                {user.username?.[0] || 'U'}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-sm">{user.username}</p>
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">{user.staff_id || `#CUA-${String(user.id).padStart(5, '0')}`}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                                            <Mail size={14} className="opacity-40" />
                                            <span className="text-sm">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <Building size={14} className="text-slate-300" />
                                            <span className="text-sm font-bold text-slate-700">{user.department}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            {user.manager_name ? (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                        {user.manager_name[0]}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-600">{user.manager_name}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">N/A</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                            user.is_active
                                                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                                : "bg-slate-100 border-slate-200 text-slate-400"
                                        )}>
                                            <Activity size={10} className={user.is_active ? "animate-pulse" : ""} />
                                            {user.is_active ? "Authorized" : "Inactive"}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-wrap gap-2">
                                            {user.roles.map((role: string) => (
                                                <span key={role} className="px-3 py-1 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100">
                                                    {role}
                                                </span>
                                            ))}
                                            {user.roles.length === 0 && <span className="text-[9px] text-slate-400 italic">No role</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <UserTableActions user={user} managers={managers} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Add a spacer at the bottom to ensure the last row's dropdown has space if needed */}
                <div className="h-20" />
            </div>
        </div>
    );
}
