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
                className="flex items-center justify-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-emerald-900/10 hover:bg-emerald-500 transition-all hover:-translate-y-0.5"
            >
                <UserPlus size={20} />
                Provision New Account
            </button>

            {showCreateModal && (
                <div className="fixed inset-0 bg-[#1a365d]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <CreateUserForm onClose={() => setShowCreateModal(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
