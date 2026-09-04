'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import CreateUserForm from './CreateUserForm';

export default function CreateUserFormWrapper() {
    const [showCreateModal, setShowCreateModal] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-3 bg-[#1a365d] text-white px-6 py-3 rounded-none font-bold text-xs uppercase tracking-wider shadow-md hover:bg-blue-900 transition-all"
            >
                <UserPlus size={16} />
                Provision New Account
            </button>

            {showCreateModal && (
                <div className="fixed inset-0 bg-[#1a365d]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-none shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                        <CreateUserForm onClose={() => setShowCreateModal(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
