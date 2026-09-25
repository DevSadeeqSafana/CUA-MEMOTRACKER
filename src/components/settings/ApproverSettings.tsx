'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserPlus, UserMinus, UserCheck, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getApproverGroupMembers,
    searchUsersForApproverGroup,
    addApproverGroupMember,
    removeApproverGroupMember
} from '@/lib/actions';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { formatDate } from '@/lib/utils';

interface ApproverUser {
    id: number;
    full_name: string;
    email: string;
    department?: string;
    designation?: string;
    added_at?: string;
}

export default function ApproverSettings() {
    const [members, setMembers] = useState<ApproverUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<ApproverUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [pendingRemoval, setPendingRemoval] = useState<ApproverUser | null>(null);
    const searchSeq = useRef(0);

    const loadMembers = async () => {
        const res = await getApproverGroupMembers();
        if (res.success) {
            setMembers(res.members);
            setLoadError('');
        } else {
            setLoadError(res.error);
        }
        setLoading(false);
    };

    useEffect(() => {
        getApproverGroupMembers().then(res => {
            if (res.success) setMembers(res.members);
            else setLoadError(res.error);
            setLoading(false);
        });
    }, []);

    const term = search.trim();
    const showResults = term.length >= 2;

    useEffect(() => {
        if (term.length < 2) return;
        const seq = ++searchSeq.current;
        const timer = setTimeout(async () => {
            setSearching(true);
            const found = await searchUsersForApproverGroup(term);
            if (seq === searchSeq.current) {
                setResults(found);
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [term]);

    const handleAdd = async (user: ApproverUser) => {
        setBusyId(user.id);
        const res = await addApproverGroupMember(user.id);
        setBusyId(null);
        if (res.success) {
            toast.success(`${user.full_name} added to approvers`);
            setSearch('');
            setResults([]);
            await loadMembers();
        } else {
            toast.error(res.error || 'Failed to add approver');
        }
    };

    const handleRemove = async () => {
        if (!pendingRemoval) return;
        const user = pendingRemoval;
        setBusyId(user.id);
        const res = await removeApproverGroupMember(user.id);
        setBusyId(null);
        setPendingRemoval(null);
        if (res.success) {
            toast.success(`${user.full_name} removed from approvers`);
            await loadMembers();
        } else {
            toast.error(res.error || 'Failed to remove approver');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex items-start gap-4">
                <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <p className="text-xs text-blue-900 font-semibold leading-relaxed">
                    Members of this group get an extra option when approving a memo:
                    <span className="font-black"> Approve & Send to Accountant</span>. The memo is approved as usual and is
                    also placed in the Accountant&apos;s processing queue. Choosing <span className="font-black">Approve Only</span> keeps the normal flow.
                </p>
            </div>

            {/* Add approver */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Add Approver</label>
                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search staff by name, email or designation..."
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900 text-xs"
                    />
                    {searching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />}
                </div>
                {showResults && !searching && (
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                        {results.length === 0 ? (
                            <p className="p-4 text-xs text-slate-400 font-semibold">No matching staff found.</p>
                        ) : results.map(user => (
                            <div key={user.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{user.full_name}</p>
                                    <p className="text-[11px] text-slate-400 font-semibold truncate">
                                        {[user.designation, user.email].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleAdd(user)}
                                    disabled={busyId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1a365d] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-800 transition-all disabled:opacity-50 shrink-0"
                                >
                                    {busyId === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Current approvers */}
            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-[#1a365d] uppercase tracking-[0.2em] pl-1">
                    Current Approvers {!loading && !loadError && `(${members.length})`}
                </h3>
                {loading ? (
                    <div className="flex items-center gap-3 p-6 text-slate-400 text-xs font-bold">
                        <Loader2 size={16} className="animate-spin" /> Loading approvers...
                    </div>
                ) : loadError ? (
                    <p className="p-6 text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-2xl">{loadError}</p>
                ) : members.length === 0 ? (
                    <p className="p-6 text-xs text-slate-400 font-semibold italic">No approvers yet. Search above to add one.</p>
                ) : (
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                        {members.map(member => (
                            <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                                        <UserCheck size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{member.full_name}</p>
                                        <p className="text-[11px] text-slate-400 font-semibold truncate">
                                            {[member.designation, member.email].filter(Boolean).join(' · ')}
                                            {member.added_at && ` · Added ${formatDate(member.added_at)}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPendingRemoval(member)}
                                    disabled={busyId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-50 shrink-0"
                                >
                                    {busyId === member.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!pendingRemoval}
                onClose={() => setPendingRemoval(null)}
                onConfirm={handleRemove}
                title="Remove Approver"
                description={`${pendingRemoval?.full_name} will no longer be able to send approved memos to the Accountant.`}
                confirmText="Remove"
                variant="danger"
                isLoading={busyId !== null}
            />
        </div>
    );
}
