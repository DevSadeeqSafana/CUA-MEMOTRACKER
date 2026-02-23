'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, Clock, Inbox } from 'lucide-react';
import { getNotifications, markNotificationAsRead } from '@/lib/actions';
import { cn, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        const data = await getNotifications();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Polling every 30s
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id: number) => {
        const result = await markNotificationAsRead(id);
        if (result.success) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-3 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-[#1a365d]"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-in zoom-in duration-300">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-4 w-96 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-5 duration-300">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="font-black text-[#1a365d] uppercase tracking-wider text-sm flex items-center gap-2">
                                <Bell size={16} className="text-blue-500" />
                                Notifications
                            </h3>
                            <button
                                onClick={fetchNotifications}
                                className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-12 text-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                        <Inbox size={24} />
                                    </div>
                                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Digital Archive Empty</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={cn(
                                                "p-5 hover:bg-slate-50 transition-all group relative",
                                                !notif.is_read && "bg-blue-50/30"
                                            )}
                                        >
                                            <div className="flex gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                                    !notif.is_read ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/10" : "bg-slate-50 border-slate-100 text-slate-400"
                                                )}>
                                                    <Bell size={16} />
                                                </div>
                                                <div className="flex-grow space-y-1">
                                                    <p className={cn(
                                                        "text-xs leading-relaxed",
                                                        !notif.is_read ? "text-slate-900 font-bold" : "text-slate-500 font-medium"
                                                    )}>
                                                        {notif.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                        <Clock size={10} />
                                                        {formatDate(notif.created_at)}
                                                    </div>
                                                </div>
                                                {!notif.is_read && (
                                                    <button
                                                        onClick={() => handleMarkAsRead(notif.id)}
                                                        className="p-1 text-blue-500 hover:bg-white rounded-lg border border-transparent hover:border-blue-100 transition-all opacity-0 group-hover:opacity-100"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            {notif.memo_uuid && (
                                                <Link
                                                    href={`/dashboard/memos/${notif.memo_uuid}`}
                                                    onClick={() => setIsOpen(false)}
                                                    className="inline-block mt-3 text-[9px] font-black text-blue-600 bg-white border border-blue-100 px-3 py-1 rounded-lg uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                                                >
                                                    View Memo Archive
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                            <Link
                                href="/dashboard/tasks"
                                onClick={() => setIsOpen(false)}
                                className="text-[10px] font-black text-slate-400 hover:text-[#1a365d] uppercase tracking-[0.2em] transition-all"
                            >
                                Management Command Center
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
