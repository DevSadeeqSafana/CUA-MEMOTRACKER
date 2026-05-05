
'use client';

import { useState } from 'react';
import { 
    ChevronDown, 
    ChevronUp, 
    Mail, 
    Building, 
    Activity, 
    UserPlus, 
    RefreshCw, 
    Search,
    Loader2,
    Check,
    X,
    Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UserTableActions from './UserTableActions';
import { updateLineManager, searchManagers } from '@/lib/actions';
import toast from 'react-hot-toast';

interface UserRowProps {
    user: any;
    managers: any[];
}

export default function UserRow({ user, managers }: UserRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAssigningLM, setIsAssigningLM] = useState(false);
    const [managerSearchTerm, setManagerSearchTerm] = useState('');
    const [availableManagers, setAvailableManagers] = useState<any[]>([]);
    const [isSearchingManagers, setIsSearchingManagers] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSearch = async (term: string) => {
        setManagerSearchTerm(term);
        if (term.length < 2) {
            setAvailableManagers([]);
            return;
        }

        setIsSearchingManagers(true);
        try {
            const results = await searchManagers(term);
            setAvailableManagers(results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearchingManagers(false);
        }
    };

    const handleAssignLM = async (managerId: number) => {
        setIsUpdating(true);
        try {
            const result = await updateLineManager(user.id, managerId);
            if (result.success) {
                toast.success('Line Manager assigned successfully');
                setIsAssigningLM(false);
                setManagerSearchTerm('');
            } else {
                toast.error(result.error || 'Failed to assign manager');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            <tr className={cn(
                "group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0",
                !user.is_active && "opacity-60 bg-slate-50/30",
                isExpanded && "bg-blue-50/20"
            )}>
                <td className="px-4 md:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400"
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
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
                <td className="px-4 md:px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Mail size={14} className="opacity-40" />
                        <span className="text-sm">{user.email}</span>
                    </div>
                </td>
                <td className="px-4 md:px-8 py-6">
                    <div className="flex items-center gap-2">
                        <Building size={14} className="text-slate-300" />
                        <span className="text-sm font-bold text-slate-700">{user.department}</span>
                    </div>
                </td>
                <td className="px-4 md:px-8 py-6">
                    <div className="flex items-center gap-3">
                        {user.manager_name ? (
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                    {user.manager_name[0]}
                                </div>
                                <span className="text-sm font-medium text-slate-600">{user.manager_name}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">N/A</span>
                        )}
                        
                        <button 
                            onClick={() => {
                                setIsExpanded(true);
                                setIsAssigningLM(true);
                            }}
                            className={cn(
                                "p-1.5 rounded-lg transition-all border shrink-0",
                                user.line_manager_id 
                                    ? "text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-white" 
                                    : "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100"
                            )}
                            title={user.line_manager_id ? "Change Line Manager" : "Assign Line Manager"}
                        >
                            {user.line_manager_id ? <RefreshCw size={12} /> : <UserPlus size={12} />}
                        </button>
                    </div>
                </td>
                <td className="px-4 md:px-8 py-6">
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
                <td className="px-4 md:px-8 py-6">
                    <div className="flex flex-wrap gap-2">
                        {user.roles.map((role: string) => (
                            <span key={role} className="px-3 py-1 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100">
                                {role}
                            </span>
                        ))}
                    </div>
                </td>
                <td className="px-4 md:px-8 py-6 text-right">
                    <UserTableActions user={user} managers={managers} />
                </td>
            </tr>

            {/* Expanded Content */}
            {isExpanded && (
                <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-8 py-8 border-b border-slate-100">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-top-2 duration-300">
                            {/* Profile Info */}
                            <div className="lg:col-span-4 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Detailed Profile</h4>
                                <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Internal ID</span>
                                        <span className="font-bold text-slate-900">#CUA-{String(user.id).padStart(5, '0')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Staff Identity</span>
                                        <span className="font-bold text-slate-900">{user.staff_id || 'NOT LINKED'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Department</span>
                                        <span className="font-bold text-slate-900">{user.department}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Line Manager Assignment */}
                            <div className="lg:col-span-8 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hierarchy Management</h4>
                                    {!isAssigningLM && (
                                        <button 
                                            onClick={() => setIsAssigningLM(true)}
                                            className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            {user.line_manager_id ? 'Change Manager' : 'Assign Manager'}
                                        </button>
                                    )}
                                </div>

                                {isAssigningLM ? (
                                    <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-xl shadow-blue-900/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-[#1a365d]">Search for Line Manager</p>
                                            <button onClick={() => setIsAssigningLM(false)} className="text-slate-400 hover:text-red-500">
                                                <X size={18} />
                                            </button>
                                        </div>
                                        
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Enter name or staff ID..."
                                                value={managerSearchTerm}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-12 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            />
                                            {isSearchingManagers && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
                                        </div>

                                        {availableManagers.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                                {availableManagers.map(mgr => (
                                                    <button
                                                        key={mgr.id}
                                                        onClick={() => handleAssignLM(mgr.id)}
                                                        disabled={isUpdating}
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                            {mgr.username[0]}
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <p className="text-sm font-bold text-slate-900 truncate">{mgr.username}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{mgr.department}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white p-8 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                                        {user.manager_name ? (
                                            <>
                                                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1a365d] flex items-center justify-center border border-blue-100 relative shadow-inner">
                                                    <Shield size={32} className="opacity-10 absolute" />
                                                    <span className="text-2xl font-black">{user.manager_name[0]}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[#1a365d] font-outfit uppercase tracking-tight">Report Chain Established</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">{user.username} reports directly to <span className="font-bold text-slate-900">{user.manager_name}</span>.</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 relative">
                                                    <UserPlus size={32} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[#1a365d] font-outfit uppercase tracking-tight">No Manager Assigned</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">This user is currently not linked to any line manager in the system hierarchy.</p>
                                                </div>
                                                <button 
                                                    onClick={() => setIsAssigningLM(true)}
                                                    className="px-6 py-2 bg-[#1a365d] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2c5282] transition-all shadow-lg shadow-blue-900/20"
                                                >
                                                    Assign Manager Now
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
