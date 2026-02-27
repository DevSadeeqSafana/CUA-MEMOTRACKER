'use client';

import { useState } from 'react';
import {
    Users,
    UserPlus,
    ArrowRight,
    X,
    Check,
    Search,
    Plus,
    Loader2,
    Settings2,
    Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateMemoRouting } from '@/lib/actions';
import toast from 'react-hot-toast';

interface User {
    id: number;
    username: string;
    department: string;
}

interface LineManagerRoutingAdjustmentProps {
    memoId: number;
    initialRecipients: User[];
    initialApprovers: User[];
    availableUsers: User[];
    availableManagers: User[];
}

export default function LineManagerRoutingAdjustment({
    memoId,
    initialRecipients,
    initialApprovers,
    availableUsers,
    availableManagers
}: LineManagerRoutingAdjustmentProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedRecipients, setSelectedRecipients] = useState<number[]>(
        initialRecipients.map(r => r.id)
    );
    const [additionalApprovers, setAdditionalApprovers] = useState<{ id: number; name: string }[]>([]);

    const [userSearchText, setUserSearchText] = useState('');
    const [managerSearchText, setManagerSearchText] = useState('');

    const filteredUsers = availableUsers.filter(u =>
        u.username.toLowerCase().includes(userSearchText.toLowerCase()) ||
        u.department?.toLowerCase().includes(userSearchText.toLowerCase())
    );

    const filteredManagers = availableManagers.filter(u =>
        u.username.toLowerCase().includes(managerSearchText.toLowerCase()) ||
        u.department?.toLowerCase().includes(managerSearchText.toLowerCase())
    );

    const toggleRecipient = (id: number) => {
        setSelectedRecipients(prev =>
            prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
        );
    };

    const addApprover = (manager: User) => {
        if (additionalApprovers.some(a => a.id === manager.id)) return;
        setAdditionalApprovers(prev => [...prev, { id: manager.id, name: manager.username }]);
    };

    const removeAdditionalApprover = (id: number) => {
        setAdditionalApprovers(prev => prev.filter(a => a.id !== id));
    };

    const handleSaveChanges = async () => {
        if (selectedRecipients.length === 0) {
            toast.error('At least one recipient is required.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await updateMemoRouting(memoId, selectedRecipients, additionalApprovers);
            if (result.success) {
                toast.success('Routing adjusted successfully');
                setIsEditing(false);
            } else {
                toast.error(result.error || 'Failed to adjust routing');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isEditing) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all font-bold text-[10px] uppercase tracking-widest"
            >
                <Settings2 size={14} />
                Adjust Routing Path
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1a365d] text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
                            <Settings2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-[#1a365d] font-outfit uppercase">Adjust Routing</h2>
                            <p className="text-[11px] text-slate-400 font-medium">Modify destination or add intermediate approvers.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                    {/* Left Side: Recipients */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <Users className="text-blue-500" size={20} />
                                <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-wider">Final Recipients</h3>
                            </div>
                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">
                                {selectedRecipients.length} Selected
                            </span>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search by name or department..."
                                value={userSearchText}
                                onChange={(e) => setUserSearchText(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-5 text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => toggleRecipient(user.id)}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                                        selectedRecipients.includes(user.id)
                                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                            : "bg-white border-slate-100 hover:border-blue-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                            selectedRecipients.includes(user.id) ? "bg-white/20" : "bg-slate-100 text-slate-400"
                                        )}>
                                            {user.username[0]}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold leading-none mb-1">{user.username}</p>
                                            <p className={cn(
                                                "text-[9px] font-black uppercase tracking-widest",
                                                selectedRecipients.includes(user.id) ? "text-blue-100" : "text-slate-400"
                                            )}>{user.department}</p>
                                        </div>
                                    </div>
                                    {selectedRecipients.includes(user.id) && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Additional Approvers */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <UserPlus className="text-amber-500" size={20} />
                                <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-wider">Additional Approvers</h3>
                            </div>
                            <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-1 rounded-full uppercase">
                                Sequential Flow
                            </span>
                        </div>

                        {/* Current Flow Viz */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">1</div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ongoing: You (Line Manager)</span>
                            </div>

                            {additionalApprovers.length > 0 && (
                                <div className="space-y-4">
                                    {additionalApprovers.map((app, idx) => (
                                        <div key={app.id} className="relative pl-3 border-l-2 border-amber-200 ml-[11px] py-1">
                                            <div className="flex items-center justify-between bg-white border border-amber-100 rounded-xl p-3 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">
                                                        {idx + 2}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-700">{app.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => removeAdditionalApprover(app.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[10px] font-black">
                                    {additionalApprovers.length + 2}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Distribution to Recipients</span>
                                <ArrowRight className="text-slate-200 ml-auto" size={14} />
                            </div>
                        </div>

                        {/* Search Managers */}
                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add to Approval Chain (e.g. Registrar, VC)</p>
                            <div className="relative">
                                <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search for authorized approvers..."
                                    value={managerSearchText}
                                    onChange={(e) => setManagerSearchText(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-5 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredManagers.map(manager => (
                                    <button
                                        key={manager.id}
                                        onClick={() => addApprover(manager)}
                                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-amber-300 transition-all text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-[10px] font-black">
                                                {manager.username[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold leading-none mb-1 text-slate-900">{manager.username}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{manager.department}</p>
                                            </div>
                                        </div>
                                        <Plus className="text-slate-300" size={14} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-[9px] text-slate-400 font-bold max-w-sm italic">
                        Changes will be captured in the audit log with your signature.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={isLoading}
                            className="flex items-center gap-3 px-8 py-3 bg-[#1a365d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-[#2c5282] transition-all disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            Save Routing Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
