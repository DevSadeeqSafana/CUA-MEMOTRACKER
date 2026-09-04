export const dynamic = 'force-dynamic';
import { getRecipients } from '@/lib/actions';
import NewMemoClient from './NewMemoClient';

import { PlusCircle } from 'lucide-react';

export default async function NewMemoPage() {
    const recipients = await getRecipients();

    return (
        <div className="space-y-6 animate-in fade-in duration-700 font-sans pb-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-none">
                <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 bg-[#1a365d] text-white flex items-center justify-center font-bold shrink-0 rounded-none">
                        <PlusCircle size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1a365d] font-outfit uppercase">Compose Internal Memo</h1>
                        <p className="text-xs text-slate-500 font-medium">Create and route official university communications, approvals, and budget requisitions.</p>
                    </div>
                </div>
            </div>

            <NewMemoClient recipients={recipients} />
        </div>
    );
}
