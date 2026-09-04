'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}: ConfirmationModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700 shadow-red-900/20',
        warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20',
        info: 'bg-[#1a365d] hover:bg-blue-800 shadow-blue-900/20'
    };

    const iconStyles = {
        danger: 'text-red-600 bg-red-50',
        warning: 'text-amber-600 bg-amber-50',
        info: 'text-blue-600 bg-blue-50'
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="fixed inset-0 bg-[#1a365d]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-none shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center space-y-5">
                    <div className={cn("w-16 h-16 rounded-none flex items-center justify-center border", iconStyles[variant])}>
                        <AlertCircle size={32} />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-[#1a365d] font-outfit tracking-tight uppercase">{title}</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{description}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={cn(
                                "flex-1 py-3 rounded-none text-white text-xs uppercase tracking-wider font-bold transition-all shadow-md disabled:opacity-50",
                                variantStyles[variant]
                            )}
                        >
                            {isLoading ? 'Processing...' : confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-3 rounded-none bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
