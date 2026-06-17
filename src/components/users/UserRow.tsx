
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    ChevronDown, 
    ChevronUp, 
    Mail, 
    Building, 
    UserPlus,
    UserMinus,
    RefreshCw, 
    Search,
    Loader2,
    X,
    Shield,
    Users
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
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const openModal = () => {
        setManagerSearchTerm('');
        setAvailableManagers([]);
        setIsAssigningLM(true);
    };

    const closeModal = () => {
        setIsAssigningLM(false);
        setManagerSearchTerm('');
        setAvailableManagers([]);
    };

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
                closeModal();
            } else {
                toast.error(result.error || 'Failed to assign manager');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveLM = async () => {
        setIsUpdating(true);
        try {
            const result = await updateLineManager(user.id, null);
            if (result.success) {
                toast.success('Line Manager removed successfully');
                closeModal();
            } else {
                toast.error(result.error || 'Failed to remove manager');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsUpdating(false);
        }
    };

    const assignModal = mounted && isAssigningLM && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-[#1a365d]/50 backdrop-blur-sm" onClick={closeModal} />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-8 pt-8 pb-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1a365d] flex items-center justify-center border border-blue-100">
                            <Users size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-tight">
                                {user.line_manager_id ? 'Change Line Manager' : 'Assign Line Manager'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                For: {user.staff_id || `#CUA-${String(user.id).padStart(5, '0')}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeModal}
                        className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Current manager info + Remove option */}
                {user.manager_name && (
                    <div className="px-8 py-4 bg-slate-50/60 border-b border-slate-100 shrink-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Manager</p>
                        <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#1a365d] text-white flex items-center justify-center font-black text-xs">
                                    {user.manager_name[0]}
                                </div>
                                <span className="text-sm font-bold text-slate-700">{user.manager_name}</span>
                            </div>
                            <button
                                onClick={handleRemoveLM}
                                disabled={isUpdating}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 hover:border-red-200 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                            >
                                {isUpdating ? <span className="animate-pulse">...</span> : <UserMinus size={11} />}
                                Remove
                            </button>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="px-8 py-5 shrink-0">
                    <div className="relative group">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"
                            size={15}
                        />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search by name or staff ID..."
                            value={managerSearchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-10 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        />
                        {isSearchingManagers && (
                            <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                        )}
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-2 min-h-[80px]">
                    {managerSearchTerm.length < 2 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Search size={24} className="text-slate-200 mb-2" />
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                                Type at least 2 characters to search
                            </p>
                        </div>
                    ) : availableManagers.length === 0 && !isSearchingManagers ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">No managers found</p>
                        </div>
                    ) : (
                        availableManagers.map(mgr => (
                            <button
                                key={mgr.id}
                                onClick={() => handleAssignLM(mgr.id)}
                                disabled={isUpdating}
                                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group disabled:opacity-50"
                            >
                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                    {mgr.username[0]}
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <p className="text-sm font-bold text-slate-800 truncate">{mgr.username}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{mgr.department}</p>
                                </div>
                                {isUpdating ? (
                                    <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                                ) : (
                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        Select
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            <tr className={cn(
                "group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0",
                !user.is_active && "opacity-60 bg-slate-50/30",
                isExpanded && "bg-blue-50/20"
            )}>
                <td className="px-4 md:px-6 py-3.5">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400"
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-center leading-none select-none uppercase",
                            user.is_active ? "bg-[#1a365d] text-white" : "bg-slate-200 text-slate-500"
                        )}>
                            {(user.username && user.username[0]) || 'U'}
                        </div>
                        <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-xs">
                                {user.staff_id || `#CUA-${String(user.id).padStart(5, '0')}`}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium">
                                {user.username}
                            </p>
                        </div>
                    </div>
                </td>
                <td className="px-4 md:px-6 py-3.5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Mail size={14} className="opacity-40" />
                        <span className="text-sm">{user.email}</span>
                    </div>
                </td>
                <td className="px-4 md:px-6 py-3.5">
                    <div className="flex items-center gap-2">
                        <Building size={14} className="text-slate-300" />
                        <span className="text-sm font-bold text-slate-700">{user.department}</span>
                    </div>
                </td>
                <td className="px-4 md:px-6 py-3.5">
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
                            onClick={openModal}
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
                <td className="px-4 md:px-6 py-3.5">
                    <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                        {user.roles.map((role: string) => (
                            <span key={role} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 shrink-0">
                                {role}
                            </span>
                        ))}
                    </div>
                </td>
                <td className="px-4 md:px-6 py-3.5 text-right">
                    <UserTableActions user={user} managers={managers} />
                </td>
            </tr>

            {/* Expanded Content - simplified: just profile info since manager is now in modal */}
            {isExpanded && (
                <tr className="bg-slate-50/50">
                    <td colSpan={6} className="px-8 py-6 border-b border-slate-100">
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Detailed Profile</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Internal ID</span>
                                        <span className="font-bold text-slate-900 text-xs">#CUA-{String(user.id).padStart(5, '0')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Staff ID</span>
                                        <span className="font-bold text-slate-900 text-xs">{user.staff_id || 'NOT LINKED'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Department</span>
                                        <span className="font-bold text-slate-900 text-xs">{user.department}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Status</span>
                                        <span className={cn("font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-lg", user.is_active ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400 border border-slate-200")}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-3">Reporting To</p>
                                    {user.manager_name ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#1a365d] text-white flex items-center justify-center font-black text-sm relative">
                                                <Shield size={20} className="opacity-10 absolute" />
                                                <span>{user.manager_name[0]}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-[#1a365d] uppercase tracking-tight">{user.manager_name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Line Manager</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-amber-600">
                                            <UserPlus size={16} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">No manager assigned</span>
                                        </div>
                                    )}
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={openModal}
                                            className="flex-1 px-4 py-2 bg-[#1a365d] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2c5282] transition-all shadow-sm"
                                        >
                                            {user.line_manager_id ? 'Change Manager' : 'Assign Manager'}
                                        </button>
                                        {user.line_manager_id && (
                                            <button
                                                onClick={handleRemoveLM}
                                                disabled={isUpdating}
                                                className="px-4 py-2 bg-red-50 border border-red-200 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                <UserMinus size={12} />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-3">System Roles</p>
                                    <div className="flex flex-wrap gap-2">
                                        {user.roles.length > 0 ? user.roles.map((role: string) => (
                                            <span key={role} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100">
                                                {role}
                                            </span>
                                        )) : (
                                            <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">No roles assigned</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* Line Manager Assignment Modal */}
            {assignModal}
        </>
    );
}
