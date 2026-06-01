'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Star,
    Inbox,
    Send,
    FileText,
    AlertCircle,
    Search,
    Paperclip,
    Wallet,
    Clock,
    ArrowRight,
    ChevronRight,
    CheckCircle2,
    Trash2,
    ShieldCheck,
    Tag,
    ChevronLeft,
    Check,
    MessageSquare,
    Sparkles,
    Filter,
    CheckSquare
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface MemoInboxContainerProps {
    memos: any[];
    initialFolder?: string;
}

export default function MemoInboxContainer({ memos, initialFolder = 'inbox' }: MemoInboxContainerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Synced search parameter folder or fallback
    const folder = searchParams.get('folder') || initialFolder;
    const [tab, setTab] = useState<'all' | 'primary' | 'budget' | 'actions' | 'policy'>('all');
    const [search, setSearch] = useState('');
    const [starredIds, setStarredIds] = useState<Set<number>>(new Set());

    // Toggle local visual star state
    const toggleStar = (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();
        setStarredIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Filter memos based on Folder, Classification Tab, and Search Query
    const filteredMemos = useMemo(() => {
        return memos.filter(memo => {
            // 1. Folder filter
            if (folder === 'inbox') {
                if (memo.folder !== 'inbox' && memo.folder !== 'actions') return false;
            } else if (folder === 'important') {
                const isStarred = memo.priority === 'High' || starredIds.has(memo.id);
                if (!isStarred) return false;
            } else if (folder === 'sent') {
                if (memo.folder !== 'sent') return false;
            } else if (folder === 'drafts') {
                if (memo.folder !== 'drafts') return false;
            } else if (folder === 'actions') {
                if (memo.folder !== 'actions') return false;
            }

            // 2. Classification Tab filter
            if (tab === 'primary') {
                // Primary: General info, Informational memos
                if (memo.is_budget_memo || memo.memo_type === 'Action' || memo.memo_type === 'Approval') return false;
            } else if (tab === 'budget') {
                // Budget requisitions
                if (!memo.is_budget_memo) return false;
            } else if (tab === 'actions') {
                // Signature / decisions / actions needed
                if (memo.memo_type !== 'Action' && memo.memo_type !== 'Approval' && memo.folder !== 'actions') return false;
            } else if (tab === 'policy') {
                // Official Strategic policies / Governance
                const strategicCategories = ['Strategic Policy', 'Exams', 'Policy'];
                if (!strategicCategories.includes(memo.category)) return false;
            }

            // 3. Search query filter
            if (search.trim()) {
                const q = search.toLowerCase();
                const titleMatch = memo.title?.toLowerCase().includes(q);
                const refMatch = memo.reference_number?.toLowerCase().includes(q);
                const creatorMatch = memo.creator_name?.toLowerCase().includes(q);
                const deptMatch = memo.department?.toLowerCase().includes(q);
                const contentMatch = memo.content?.replace(/<[^>]*>/g, '').toLowerCase().includes(q);
                
                if (!titleMatch && !refMatch && !creatorMatch && !deptMatch && !contentMatch) return false;
            }

            return true;
        });
    }, [memos, folder, tab, search, starredIds]);

    // Calculate unread counts under each tab for Inbox
    const tabCounts = useMemo(() => {
        const counts = { primary: 0, budget: 0, actions: 0, policy: 0 };
        
        memos.forEach(memo => {
            // Only count unread received inbox items or active actions
            if (memo.folder !== 'inbox' && memo.folder !== 'actions') return;
            if (!memo.is_unread) return;

            if (memo.is_budget_memo) {
                counts.budget++;
            } else if (memo.memo_type === 'Action' || memo.memo_type === 'Approval' || memo.folder === 'actions') {
                counts.actions++;
            } else if (['Strategic Policy', 'Exams', 'Policy'].includes(memo.category)) {
                counts.policy++;
            } else {
                counts.primary++;
            }
        });

        return counts;
    }, [memos]);

    // Quick helper to strip HTML tags for mail preview body snippet
    const getSnippet = (htmlContent: string) => {
        if (!htmlContent) return '';
        const rawText = htmlContent.replace(/<[^>]*>/g, ' ');
        return rawText.length > 95 ? rawText.substring(0, 95) + '...' : rawText;
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col font-sans h-full min-h-[600px] animate-in fade-in duration-500">
            {/* Topbar: Title, Stats, Search */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                            {folder === 'inbox' && <Inbox size={18} />}
                            {folder === 'important' && <Star size={18} className="text-amber-500 fill-amber-500" />}
                            {folder === 'actions' && <AlertCircle size={18} />}
                            {folder === 'sent' && <Send size={18} />}
                            {folder === 'drafts' && <FileText size={18} />}
                        </div>
                        <h1 className="text-xl font-black text-[#1a365d] uppercase tracking-tight capitalize font-outfit">
                            {folder === 'inbox' ? 'Inbox' : folder === 'actions' ? 'Action Queue' : folder === 'sent' ? 'Sent Memos' : folder}
                        </h1>
                        <span className="bg-slate-200/60 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shrink-0">
                            {filteredMemos.length} item{filteredMemos.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:max-w-xs md:max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search memos..."
                        className="w-full bg-white border border-slate-200 focus:border-blue-500 outline-none rounded-2xl pl-11 pr-4 py-2.5 text-xs font-bold transition-all shadow-inner placeholder:text-slate-300 text-slate-700"
                    />
                </div>
            </div>

            {/* Classification Tabs (Gmail style) */}
            <div className="flex border-b border-slate-100 overflow-x-auto select-none shrink-0 scrollbar-none">
                {/* 1. All */}
                <button
                    onClick={() => setTab('all')}
                    className={cn(
                        "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                        tab === 'all'
                            ? "border-blue-600 text-blue-600 bg-blue-50/20"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Filter size={15} />
                    All Memos
                </button>

                {/* 2. Primary / General Memos */}
                <button
                    onClick={() => setTab('primary')}
                    className={cn(
                        "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                        tab === 'primary'
                            ? "border-blue-500 text-blue-600 bg-blue-50/10"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Inbox size={15} />
                    Primary
                    {tabCounts.primary > 0 && (
                        <span className="bg-blue-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                            {tabCounts.primary}
                        </span>
                    )}
                </button>

                {/* 3. Budget & Finance */}
                <button
                    onClick={() => setTab('budget')}
                    className={cn(
                        "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                        tab === 'budget'
                            ? "border-emerald-500 text-emerald-700 bg-emerald-50/10"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Wallet size={15} />
                    Budget & Finance
                    {tabCounts.budget > 0 && (
                        <span className="bg-emerald-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                            {tabCounts.budget}
                        </span>
                    )}
                </button>

                {/* 4. Actions Required */}
                <button
                    onClick={() => setTab('actions')}
                    className={cn(
                        "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                        tab === 'actions'
                            ? "border-amber-500 text-amber-700 bg-amber-50/10"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                >
                    <AlertCircle size={15} />
                    Action Needed
                    {tabCounts.actions > 0 && (
                        <span className="bg-amber-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                            {tabCounts.actions}
                        </span>
                    )}
                </button>

                {/* 5. Policy & Strategic */}
                <button
                    onClick={() => setTab('policy')}
                    className={cn(
                        "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                        tab === 'policy'
                            ? "border-purple-500 text-purple-700 bg-purple-50/10"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                >
                    <ShieldCheck size={15} />
                    Policy & Strategy
                    {tabCounts.policy > 0 && (
                        <span className="bg-purple-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                            {tabCounts.policy}
                        </span>
                    )}
                </button>
            </div>

            {/* Memos List */}
            <div className="flex-grow overflow-y-auto min-h-[350px]">
                {filteredMemos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 text-slate-200">
                            <Clock size={32} />
                        </div>
                        <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-wider">Inbox is Empty</h3>
                        <p className="text-xs text-slate-400 font-bold max-w-sm uppercase tracking-wider leading-relaxed">
                            No memos match the selected folder, filter tab, or search criteria.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredMemos.map(memo => {
                            const isStarred = memo.priority === 'High' || starredIds.has(memo.id);
                            
                            return (
                                <div
                                    key={memo.id}
                                    onClick={() => router.push(`/dashboard/memos/${memo.uuid}`)}
                                    className={cn(
                                        "flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-all cursor-pointer relative group",
                                        memo.is_unread ? "bg-blue-50/20 border-l-4 border-l-blue-600" : "bg-white"
                                    )}
                                >
                                    {/* Action Box: Star Icon */}
                                    <button
                                        type="button"
                                        onClick={(e) => toggleStar(e, memo.id)}
                                        className="shrink-0 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                                    >
                                        <Star
                                            size={16}
                                            className={cn(
                                                "transition-all",
                                                isStarred ? "text-amber-500 fill-amber-500 scale-110" : "opacity-40 group-hover:opacity-100"
                                            )}
                                        />
                                    </button>

                                    {/* Sender Column */}
                                    <div className="w-40 md:w-48 shrink-0 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] uppercase tracking-wider shrink-0",
                                                memo.is_unread ? "bg-blue-600 text-white shadow-md shadow-blue-600/10" : "bg-slate-100 text-slate-400"
                                            )}>
                                                {memo.creator_name?.[0]}
                                            </div>
                                            <span className={cn(
                                                "text-xs truncate block",
                                                memo.is_unread ? "font-black text-slate-800" : "font-semibold text-slate-500"
                                            )}>
                                                {memo.creator_name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Subject & snippet column */}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "text-xs truncate shrink-0 max-w-[200px] md:max-w-[320px] tracking-tight uppercase",
                                                memo.is_unread ? "font-black text-slate-800" : "font-bold text-slate-600"
                                            )}>
                                                {memo.title}
                                            </span>
                                            <span className="text-slate-300 shrink-0 select-none font-light">—</span>
                                            <span className="text-[11px] font-bold text-slate-400 truncate block">
                                                {getSnippet(memo.content)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Attachment count & Badges */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        {/* Paperclip */}
                                        {memo.attachment_count > 0 && (
                                            <span className="text-slate-300 group-hover:text-blue-500 transition-colors flex items-center gap-0.5 font-bold text-[9px] px-1 py-0.5 rounded bg-slate-50 border border-slate-100">
                                                <Paperclip size={10} />
                                                {memo.attachment_count}
                                            </span>
                                        )}
                                        {/* Budget Memo Requisition */}
                                        {memo.is_budget_memo === 1 && (
                                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                <Wallet size={9} />
                                                Budget
                                            </span>
                                        )}
                                        {/* Action Priority Badges */}
                                        {memo.action_type === 'Approval' && (
                                            <span className="bg-blue-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm shrink-0">
                                                <CheckSquare size={9} />
                                                Decision Step {memo.step_order}
                                            </span>
                                        )}
                                        {memo.action_type === 'Consultation' && (
                                            <span className="bg-purple-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm shrink-0">
                                                <MessageSquare size={9} />
                                                Input Requested
                                            </span>
                                        )}
                                        {/* Priority High Star */}
                                        {memo.priority === 'High' && (
                                            <span className="bg-red-50 text-red-600 border border-red-100 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shrink-0">
                                                Urgent
                                            </span>
                                        )}
                                    </div>

                                    {/* Date / Time Column */}
                                    <div className="w-20 shrink-0 text-right group-hover:hidden block">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {formatDate(memo.created_at)}
                                        </span>
                                    </div>

                                    {/* Quick Actions (Hover trigger) */}
                                    <div className="w-20 shrink-0 flex items-center justify-end gap-1.5 hidden group-hover:flex animate-in fade-in duration-200">
                                        <button
                                            type="button"
                                            title="Open Memo"
                                            onClick={() => router.push(`/dashboard/memos/${memo.uuid}`)}
                                            className="w-7 h-7 bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center text-blue-600 transition-all shadow-sm"
                                        >
                                            <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
