import { auth } from '@/auth';
import SettingsTabs from '@/components/settings/SettingsTabs';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user) return null;

    const roles = (session.user as any).role || [];

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 font-sans">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-[#1a365d] font-outfit">Account Settings</h1>
                <p className="text-slate-500 font-medium mt-1">Manage your digital identity within the Cosmopolitan University Abuja IMTS portal.</p>
            </div>

            <SettingsTabs user={session.user} roles={roles} />
        </div>
    );
}
