import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
    Users as UsersIcon,
    Filter,
} from 'lucide-react';
import CreateUserFormWrapper from '@/components/users/CreateUserFormWrapper';
import { getManagers } from '@/lib/actions';
import UserSearch from '@/components/users/UserSearch';
import UserRow from '@/components/users/UserRow';
import SortableHeader from '@/components/users/SortableHeader';
import Pagination from '@/components/ui/Pagination';

export default async function UserManagementPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string }>;
}) {
    const params = await searchParams;
    const q = params.q || '';
    const page = parseInt(params.page || '1');
    const sort = params.sort || 'u.username';
    const order = (params.order as 'asc' | 'desc') || 'asc';
    const limit = 25;
    const offset = (page - 1) * limit;

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

    // Fetch total count for pagination
    const countResult = await query(`
        SELECT COUNT(DISTINCT u.id) as total
        FROM memo_system_users u
        LEFT JOIN hr_staff hr ON u.staff_id = hr.StaffID
        WHERE (? IS NULL OR u.username LIKE ? OR u.email LIKE ? OR u.staff_id LIKE ? OR hr.FirstName LIKE ? OR hr.Surname LIKE ?)
    `, [queryStr, queryStr, queryStr, queryStr, queryStr, queryStr]) as any[];
    
    const totalUsers = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalUsers / limit);

    // Fetch users with sorting and pagination
    // Note: Using a safe set of allowed sort columns to prevent SQL injection
    const allowedSortCols: Record<string, string> = {
        'username': 'u.username',
        'email': 'u.email',
        'department': 'u.department',
        'staff_id': 'u.staff_id',
        'manager': 'manager_name',
        'status': 'u.is_active'
    };
    
    const orderBy = allowedSortCols[sort] || 'u.username';

    const users = await query(`
        SELECT u.id, u.uuid, 
               COALESCE(CONCAT(hr.FirstName, ' ', IFNULL(CONCAT(hr.MiddleName, ' '), ''), hr.Surname), u.username) as username, 
               u.email, u.department, u.is_active, u.staff_id, u.line_manager_id,
               COALESCE(
                   CONCAT(hr_mgr_explicit.FirstName, ' ', IFNULL(CONCAT(hr_mgr_explicit.MiddleName, ' '), ''), hr_mgr_explicit.Surname),
                   m_mgr_explicit.username,
                   CONCAT(hr_mgr_hr.FirstName, ' ', IFNULL(CONCAT(hr_mgr_hr.MiddleName, ' '), ''), hr_mgr_hr.Surname),
                   m_mgr_hr.username
               ) as manager_name,
               GROUP_CONCAT(DISTINCT r.name) as roles_list
        FROM memo_system_users u
        LEFT JOIN hr_staff hr ON u.staff_id = hr.StaffID
        LEFT JOIN memo_system_users m_mgr_hr ON hr.LineManagerID = m_mgr_hr.staff_id
        LEFT JOIN hr_staff hr_mgr_hr ON m_mgr_hr.staff_id = hr_mgr_hr.StaffID
        LEFT JOIN memo_system_users m_mgr_explicit ON u.line_manager_id = m_mgr_explicit.id
        LEFT JOIN hr_staff hr_mgr_explicit ON m_mgr_explicit.staff_id = hr_mgr_explicit.StaffID
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE (? IS NULL OR u.username LIKE ? OR u.email LIKE ? OR u.staff_id LIKE ? OR hr.FirstName LIKE ? OR hr.Surname LIKE ?)
        GROUP BY u.id, u.uuid, u.username, hr.FirstName, hr.MiddleName, hr.Surname, u.email, u.department, u.is_active, u.staff_id, u.line_manager_id, manager_name
        ORDER BY ${orderBy} ${order === 'desc' ? 'DESC' : 'ASC'}
        LIMIT ${limit} OFFSET ${offset}
    `, [queryStr, queryStr, queryStr, queryStr, queryStr, queryStr]) as any[];

    const formattedUsers = users.map(u => ({
        ...u,
        roles: u.roles_list ? u.roles_list.split(',') : [],
        is_active: u.is_active === 1 || u.is_active === true
    }));

    const managers = await getManagers();

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
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
            <div className="flex flex-col sm:flex-row gap-3">
                <UserSearch />
                <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all shadow-sm shrink-0">
                    <Filter size={16} />
                    Filters
                </button>
                <div className="flex-grow" />
                <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Users</span>
                    <span className="text-sm font-black text-[#1a365d]">{totalUsers}</span>
                </div>
            </div>

            {/* Table Interface */}
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden text-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr>
                                <SortableHeader label="Staff Identity" sortKey="username" currentSort={sort} currentOrder={order} />
                                <SortableHeader label="University Email" sortKey="email" currentSort={sort} currentOrder={order} />
                                <SortableHeader label="Department" sortKey="department" currentSort={sort} currentOrder={order} />
                                <SortableHeader label="Reporting To" sortKey="manager" currentSort={sort} currentOrder={order} />
                                <SortableHeader label="Status" sortKey="status" currentSort={sort} currentOrder={order} />
                                <th className="px-4 md:px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50">System Roles</th>
                                <th className="px-4 md:px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right bg-slate-50">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {formattedUsers.map((user) => (
                                <UserRow key={user.id} user={user} managers={managers} />
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <Pagination totalPages={totalPages} currentPage={page} />
            </div>
            
            <div className="h-10" />
        </div>
    );
}
