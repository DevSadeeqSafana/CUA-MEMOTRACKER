import { auth } from '@/auth';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { Settings } from 'lucide-react';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user) return null;

    const roles = (session.user as any).role || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-700 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-[#0b2a5b] text-white flex items-center justify-center font-bold shrink-0 rounded-full ring-2 ring-[#e3ac3a]/70 ring-offset-2">
                        <Settings size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-3xl font-medium tracking-tight text-[#0b2a5b] font-display">Account Settings</h1>
                        <p className="text-xs text-slate-500 font-medium">Manage your digital identity within the Cosmopolitan University Abuja IMTS portal.</p>
                    </div>
                </div>
            </div>

            <SettingsTabs user={session.user} roles={roles} />
        </div>
    );
}
