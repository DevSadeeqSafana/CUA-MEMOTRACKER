'use client';

import { useState, useEffect } from 'react';
import {
    Save,
    Mail,
    Building,
    Shield,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    UserCheck,
    ToggleLeft,
    ToggleRight,
    Search,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateUser, searchManagers } from '@/lib/actions';

interface EditUserFormProps {
    user: any;
    managers: any[];
    onClose: () => void;
}

export default function EditUserForm({ user, managers, onClose }: EditUserFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        username: user.username,
        email: user.email,
        department: user.department,
        roles: [...user.roles],
        line_manager_id: user.line_manager_id || null,
        is_active: user.is_active
    });

    const [managerSearchTerm, setManagerSearchTerm] = useState('');
    const [selectedManager, setSelectedManager] = useState<any>(
        user.line_manager_id ? managers.find(m => m.id === user.line_manager_id) : null
    );

    const [availableManagers, setAvailableManagers] = useState<any[]>(managers);
    const [isSearchingManagers, setIsSearchingManagers] = useState(false);

    useEffect(() => {
        if (managerSearchTerm.length < 2) {
            setAvailableManagers(managers);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingManagers(true);
            const results = await searchManagers(managerSearchTerm);
            setAvailableManagers(results);
            setIsSearchingManagers(false);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [managerSearchTerm, managers]);

    const availableRoles = [
        'Memo Creator',
        'Line Manager',
        'Reviewer',
        'Recipient',
        'Administrator'
    ];

    const toggleRole = (role: string) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(role)
                ? prev.roles.filter(r => r !== role)
                : [...prev.roles, role]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.roles.length === 0) {
            setError('Please select at least one role.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await updateUser(user.id, formData);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => onClose(), 1500);
            } else {
                setError(result.error || 'Failed to update user.');
            }
        } catch (err) {
            setError('An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 font-outfit">Identity Updated</h3>
                <p className="text-slate-500 font-medium">Internal records for {formData.username} have been synchronized.</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[#1a365d] font-outfit leading-none">Modify Account</h2>
                        <p className="text-sm text-slate-400 font-medium mt-1">Updating credentials for {user.username}.</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
                    <X size={24} />
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm animate-in shake-in font-medium">
                    <AlertCircle size={20} className="shrink-0" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-900">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Update Name</label>
                        <input
                            required
                            value={formData.username}
                            onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-6 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Update Email</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-6 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Department</label>
                        <input
                            required
                            value={formData.department}
                            readOnly
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-6 focus:ring-0 text-slate-400 font-bold cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-black text-[#1a365d] font-outfit">Account Status</p>
                        <p className="text-xs text-slate-400 font-medium">Determine if this user can access the institutional portal.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                        className="transition-all"
                    >
                        {formData.is_active ? (
                            <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase text-[10px] tracking-widest">
                                Active <ToggleRight size={32} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                Inactive <ToggleLeft size={32} />
                            </div>
                        )}
                    </button>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Access Roles</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {availableRoles.map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 border rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                                    formData.roles.includes(role)
                                        ? "bg-[#1a365d] border-[#1a365d] text-white shadow-lg"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                                )}
                            >
                                <Shield size={14} />
                                {role}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Assigned Line Manager</label>
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search Managers by Name or Staff ID..."
                            value={managerSearchTerm}
                            onChange={e => setManagerSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-14 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold"
                        />
                        {isSearchingManagers && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                <Loader2 className="animate-spin text-blue-500" size={20} />
                            </div>
                        )}
                    </div>

                    {managerSearchTerm && availableManagers.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-48 overflow-y-auto z-50 relative">
                            {availableManagers.map((manager) => (
                                <button
                                    key={manager.staff_id || manager.id}
                                    type="button"
                                    onClick={() => {
                                        if (!manager.id) {
                                            // Manager exists in HR but has no account
                                            return; // Optionally show a toast here too
                                        }
                                        setSelectedManager(manager);
                                        setFormData(prev => ({ ...prev, line_manager_id: manager.id }));
                                        setManagerSearchTerm('');
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 hover:bg-blue-50 text-left transition-all border-b border-slate-50 last:border-0",
                                        !manager.id && "opacity-50 cursor-not-allowed grayscale"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                                        manager.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                    )}>
                                        {manager.username[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm tracking-tight">{manager.username}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{manager.department} {!manager.id && "• No Account"}</p>
                                    </div>
                                </button>
                            ))
                            }
                        </div>
                    )}

                    {selectedManager && (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20">
                                    <Check size={16} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Current Manager</p>
                                    <p className="font-bold text-slate-900 text-sm">{selectedManager.username}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedManager(null); setFormData(prev => ({ ...prev, line_manager_id: null })); }}
                                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-6 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-8 py-4 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                    >
                        Discard
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-2 px-12 py-4 bg-[#1a365d] text-white rounded-2xl font-bold hover:bg-[#2c5282] transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}
