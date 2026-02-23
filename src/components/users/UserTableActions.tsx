'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    MoreVertical,
    Edit2,
    Trash2,
    UserX,
    UserCheck,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { deleteUser, toggleUserStatus } from '@/lib/actions';
import EditUserForm from '@/components/users/EditUserForm';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import toast from 'react-hot-toast';

interface UserTableActionsProps {
    user: any;
    managers: any[];
}

export default function UserTableActions({ user, managers }: UserTableActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const toggleDropdown = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX - 160 // Offset to the left to align
            });
        }
        setIsOpen(!isOpen);
    };

    // Close on scroll
    useEffect(() => {
        const handleScroll = () => setIsOpen(false);
        if (isOpen) {
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const result = await deleteUser(user.id);
            if (result.success) {
                toast.success(`User ${user.username} deleted successfully.`);
                setIsDeleteModalOpen(false);
            } else {
                toast.error(result.error || 'Failed to delete user.');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('An unexpected error occurred during deletion.');
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    const handleToggleStatus = async () => {
        setIsLoading(true);
        try {
            const result = await toggleUserStatus(user.id, user.is_active) as any;
            toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully.`);
        } catch (error) {
            console.error('Toggle status failed:', error);
            toast.error('Failed to update user status.');
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
                <MoreVertical size={20} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: coords.top - window.scrollY,
                            left: coords.left - window.scrollX,
                            zIndex: 70
                        }}
                        className="w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        <button
                            onClick={() => { setIsEditOpen(true); setIsOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Edit2 size={16} className="text-blue-500" />
                            Edit Profile
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            disabled={isLoading}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2 text-sm font-bold transition-colors",
                                user.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : user.is_active ? (
                                <UserX size={16} />
                            ) : (
                                <UserCheck size={16} />
                            )}
                            {user.is_active ? "Inactivate User" : "Activate User"}
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                            onClick={() => { setIsDeleteModalOpen(true); setIsOpen(false); }}
                            disabled={isLoading}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={16} />
                            Delete Account
                        </button>
                    </div>
                </>
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete User Account"
                description={`Are you sure you want to permanently delete ${user.username}? All their system roles will be revoked. This action cannot be undone.`}
                confirmText="Delete Account"
                isLoading={isLoading}
            />

            {isEditOpen && mounted && createPortal(
                <div className="fixed inset-0 bg-[#1a365d]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <EditUserForm
                            user={user}
                            managers={managers}
                            onClose={() => setIsEditOpen(false)}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
