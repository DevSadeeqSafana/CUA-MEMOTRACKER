'use client';

import { useState, useEffect } from 'react';
import {
    UserPlus,
    Lock,
    Shield,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    Search,
    User,
    Check,
    AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createUser, searchHRStaff, getManagers, searchManagers } from '@/lib/actions';
import toast from 'react-hot-toast';

interface CreateUserFormProps {
    onClose: () => void;
}

export default function CreateUserForm({ onClose }: CreateUserFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [hrSearchTerm, setHrSearchTerm] = useState('');
    const [hrResults, setHrResults] = useState<any[]>([]);
    const [isSearchingHR, setIsSearchingHR] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<{ status: string; roles: string } | null>(null);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

    const [availableManagers, setAvailableManagers] = useState<any[]>([]);
    const [managerSearchTerm, setManagerSearchTerm] = useState('');
    const [selectedManager, setSelectedManager] = useState<any>(null);
    const [isSearchingManagers, setIsSearchingManagers] = useState(false);

    const [formData, setFormData] = useState({
        staff_id: '',
        username: '',
        email: '',
        password: '',
        department: '',
        roles: [] as string[],
        line_manager_id: null as number | null
    });

    useEffect(() => {
        const fetchManagers = async () => {
            const managers = await getManagers();
            setAvailableManagers(managers);
        };
        fetchManagers();
    }, []);

    useEffect(() => {
        if (managerSearchTerm.length < 2) {
            // If empty, reset to initial managers if needed or just leave
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingManagers(true);
            const results = await searchManagers(managerSearchTerm);
            setAvailableManagers(results);
            setIsSearchingManagers(false);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [managerSearchTerm]);

    useEffect(() => {
        if (hrSearchTerm.length < 2) {
            setHrResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingHR(true);
            const results = await searchHRStaff(hrSearchTerm);
            setHrResults(results);
            setIsSearchingHR(false);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [hrSearchTerm]);

    const selectStaff = async (staff: any) => {
        setSelectedStaff(staff);
        setDuplicateWarning(null);
        const staffEmail = staff.OfficialEmailAddress || '';
        const staffId = staff.StaffID;

        setFormData(prev => ({
            ...prev,
            staff_id: staffId,
            username: `${staff.FirstName} ${staff.Surname}`,
            email: staffEmail,
            department: staff.DepartmentCode || '',
        }));
        setHrResults([]);
        setHrSearchTerm('');

        // Immediately check if this staff member already has an account
        setIsCheckingDuplicate(true);
        try {
            const res = await fetch(`/api/users/check-duplicate?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(staffEmail)}`);
            const data = await res.json();
            if (data.exists) {
                setDuplicateWarning({ status: data.status, roles: data.roles || 'No roles' });
            }
        } catch {
            // Silent fail — the server action will catch it on submit
        } finally {
            setIsCheckingDuplicate(false);
        }

        // AUTO-FETCH MANAGER FROM HR MAPPING
        if (staff.LineManagerID) {
            setIsSearchingManagers(true);
            try {
                const managerResults = await searchManagers(staff.LineManagerID);
                if (managerResults.length > 0) {
                    const manager = managerResults[0];
                    if (manager.id) {
                        setSelectedManager(manager);
                        setFormData(prev => ({ ...prev, line_manager_id: manager.id }));
                        toast.success(`Default Line Manager (${manager.username}) identified from HR.`);
                    } else {
                        toast.error(`HR Manager ${manager.username} found but has no system account yet.`);
                    }
                }
            } catch (err) {
                console.error("Failed to auto-fetch manager:", err);
            } finally {
                setIsSearchingManagers(false);
            }
        }
    };

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
        if (!formData.staff_id) {
            setError('Selection error: Please identify and select a verified staff member from the HR digital directory.');
            return;
        }
        if (formData.roles.length === 0) {
            setError('Governance error: At least one administrative or operational role must be assigned.');
            return;
        }
        if (!formData.line_manager_id) {
            setError('Accountability error: Every user must be assigned a Line Manager for memo validation.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await createUser(formData);
            if (result.success) {
                setSuccess(true);
                toast.success(`Account for ${formData.username} created!`);
                setTimeout(() => onClose(), 2000);
            } else {
                setError(result.error || 'Failed to create user account.');
                toast.error(result.error || 'Provisioning failed');
            }
        } catch (err) {
            setError('An unexpected system error occurred while provisioning the account.');
            toast.error('System error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 font-sans">
                <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center animate-in zoom-in duration-500">
                    <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-outfit uppercase tracking-tight">Provisioning Successful</h3>
                <p className="text-slate-500 font-medium">Institutional account for <span className="text-[#1a365d] font-bold">{formData.username}</span> has been activated.</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto font-sans bg-white">
            <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1a365d] flex items-center justify-center border border-blue-100 shadow-sm">
                        <UserPlus size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[#1a365d] font-outfit uppercase tracking-tight">Account Provisioning</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">Security & Hierarchy Configuration</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-300 hover:text-slate-600">
                    <X size={20} />
                </button>
            </div>

            {duplicateWarning && (
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-[1.5rem] animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-amber-900 uppercase tracking-tight">Account Already Exists</p>
                            <p className="text-sm text-amber-800 font-medium">
                                This staff member is already provisioned in the system.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                                    duplicateWarning.status === 'Active'
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "bg-slate-100 border-slate-200 text-slate-500"
                                )}>
                                    Status: {duplicateWarning.status}
                                </span>
                                {duplicateWarning.roles.split(', ').map(r => (
                                    <span key={r} className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 border border-blue-100 text-blue-700">
                                        {r}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-amber-700 font-bold mt-2">→ Use the Edit button on their existing profile to update roles or status.</p>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-5 rounded-2xl flex items-center gap-4 text-sm animate-in slide-in-from-top-2 font-bold uppercase tracking-wide">
                    <AlertCircle size={20} className="shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">1. Search HR Staff Directory</label>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search by Staff ID, Name, or Email..."
                        value={hrSearchTerm}
                        onChange={e => setHrSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-5 focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold text-slate-700 text-sm placeholder:text-slate-300 placeholder:font-medium"
                    />
                    {isSearchingHR && (
                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                            <Loader2 className="animate-spin text-blue-500" size={20} />
                        </div>
                    )}
                </div>

                {hrResults.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-64 overflow-y-auto z-50">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Identified {hrResults.length} records in HR cloud</span>
                        </div>
                        {hrResults.map((staff) => (
                            <button
                                key={staff.StaffID}
                                onClick={() => selectStaff(staff)}
                                className="w-full flex items-center gap-4 p-5 hover:bg-blue-50/50 text-left transition-all border-b border-slate-50 last:border-0 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {staff.FirstName[0]}{staff.Surname[0]}
                                </div>
                                <div className="flex-grow">
                                    <p className="font-bold text-slate-900 uppercase tracking-tight">{staff.FirstName} {staff.Surname}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{staff.StaffID} • {staff.DepartmentCode}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-50 text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                    <User size={16} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedStaff && (
                <div className={cn(
                    "border p-4 rounded-[1.5rem] flex items-center justify-between animate-in zoom-in-95 duration-300",
                    duplicateWarning ? "bg-amber-50/50 border-amber-200" : "bg-blue-50/50 border-blue-100"
                )}>
                    <div className="flex items-center gap-5">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-lg",
                            duplicateWarning ? "bg-amber-500 shadow-amber-900/20" : "bg-blue-600 shadow-blue-900/20"
                        )}>
                            {isCheckingDuplicate ? <Loader2 size={20} className="animate-spin" /> : duplicateWarning ? <AlertTriangle size={24} /> : <Check size={24} />}
                        </div>
                        <div>
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest leading-none mb-1",
                                duplicateWarning ? "text-amber-500" : "text-blue-400"
                            )}>
                                {isCheckingDuplicate ? 'Verifying...' : duplicateWarning ? 'Duplicate Detected' : 'Authenticated Selection'}
                            </p>
                            <h4 className="text-lg font-black text-[#1a365d] uppercase tracking-tight">{selectedStaff.FirstName} {selectedStaff.Surname}</h4>
                        </div>
                    </div>
                    <button
                        onClick={() => { setSelectedStaff(null); setDuplicateWarning(null); setFormData(prev => ({ ...prev, staff_id: '', username: '', email: '', department: '' })); }}
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">2. Assign System Access Role</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {availableRoles.map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left",
                                    formData.roles.includes(role)
                                        ? "bg-[#1a365d] border-[#1a365d] text-white shadow-xl shadow-blue-900/20"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-blue-300"
                                )}
                            >
                                <Shield size={14} className={formData.roles.includes(role) ? "text-blue-300" : "text-slate-300"} />
                                {role}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">3. Security Configuration</label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="password"
                            required
                            value={formData.password}
                            onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-5 focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold text-slate-700 text-sm placeholder:text-slate-300 placeholder:font-medium"
                            placeholder="Set Initial Account Token..."
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">4. Line Manager Assignment</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search Managers by Name or Staff ID..."
                            value={managerSearchTerm}
                            onChange={e => setManagerSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-5 focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold text-slate-700 text-sm placeholder:text-slate-300 placeholder:font-medium"
                        />
                        {isSearchingManagers && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                <Loader2 className="animate-spin text-blue-500" size={20} />
                            </div>
                        )}
                    </div>

                    {managerSearchTerm && availableManagers.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-48 overflow-y-auto">
                            {availableManagers.map((manager) => (
                                <button
                                    key={manager.staff_id || manager.id}
                                    type="button"
                                    onClick={() => {
                                        if (!manager.id) {
                                            toast.error(`${manager.username} does not have a system account. Provision them first to assign as a manager.`);
                                            return;
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
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Assigned Manager</p>
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

                <div className="pt-4 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 border border-slate-200 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-50 transition-all"
                    >
                        Decline
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || !selectedStaff || !!duplicateWarning || isCheckingDuplicate}
                        className="flex-2 px-10 py-4 bg-[#1a365d] text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-[#2c5282] transition-all shadow-2xl shadow-blue-900/40 disabled:opacity-30 flex items-center justify-center gap-3"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                        {duplicateWarning ? 'Exists' : 'Confirm'}
                    </button>
                </div>
            </form>
        </div>
    );
}
