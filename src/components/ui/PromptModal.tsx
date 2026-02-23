'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    description: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    required?: boolean;
}

export default function PromptModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    placeholder = 'Type here...',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    isLoading = false,
    required = false
}: PromptModalProps) {
    const [value, setValue] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (required && !value.trim()) return;
        onConfirm(value);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="fixed inset-0 bg-[#1a365d]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={24} />
                </button>

                <form onSubmit={handleSubmit} className="flex flex-col space-y-8">
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-blue-600 bg-blue-50">
                            <MessageSquare size={40} />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-[#1a365d] font-outfit tracking-tight">{title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">{description}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your Response {required && '*'}</label>
                        <textarea
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-6 text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all min-h-[120px] font-medium"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <button
                            type="submit"
                            disabled={isLoading || (required && !value.trim())}
                            className="flex-[2] py-4 rounded-2xl bg-[#1a365d] text-white font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? 'Processing...' : confirmText}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
