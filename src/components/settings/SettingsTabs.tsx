'use client';

import { useState } from 'react';
import {
    User,
    Lock,
    Bell,
    Shield,
    Smartphone,
    AlertCircle as AlertIcon,
    CheckCircle2,
    Mail,
    ShieldAlert,
    ShieldCheck,
    Eye,
    EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { changePassword } from '@/lib/actions';

interface SettingsTabsProps {
    user: any;
    roles: string[];
}

export default function SettingsTabs({ user, roles }: SettingsTabsProps) {
    const [activeTab, setActiveTab] = useState('profile');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdStatus, setPwdStatus] = useState<{ loading: boolean; error: string | null; success: boolean }>({
        loading: false,
        error: null,
        success: false
    });

    const tabs = [
        { id: 'profile', label: 'Personal Profile', icon: User },
        { id: 'security', label: 'Security & Keys', icon: Lock },
        { id: 'notifications', label: 'Alert Preferences', icon: Bell },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Sidebar Navigation */}
            <div className="space-y-4">
                <nav className="flex flex-col space-y-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-3 px-6 py-4 text-sm font-bold rounded-2xl text-left transition-all",
                                    activeTab === tab.id
                                        ? "bg-[#1a365d] text-white shadow-lg shadow-blue-900/10"
                                        : "text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <Icon size={20} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="md:col-span-2 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                {activeTab === 'profile' && (
                    <>
                        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm space-y-8">
                            <div className="border-b border-slate-100 pb-6">
                                <h2 className="text-xl font-black text-[#1a365d] font-outfit">Official Profile</h2>
                                <p className="text-sm text-slate-400 font-medium">Verified information from the University Human Resources database.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Full Legal Name</p>
                                    <p className="text-base font-bold text-slate-900">{user.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Official Email</p>
                                    <p className="text-base font-bold text-slate-900 lowercase">{user.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Assigned Department</p>
                                    <p className="text-base font-bold text-[#1a365d]">{user.department || 'General Administration'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">University Staff ID</p>
                                    <p className="text-base font-bold text-slate-900">#CUA-{user.id.padStart(5, '0')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm space-y-8">
                            <div className="border-b border-slate-100 pb-6">
                                <h2 className="text-xl font-black text-[#1a365d] font-outfit">Access Control</h2>
                                <p className="text-sm text-slate-400 font-medium">Your authorized roles within the Internal Memo Tracker System.</p>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                {roles.map((role: string) => (
                                    <div key={role} className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-100 rounded-2xl transition-all hover:bg-blue-100">
                                        <Shield size={18} className="text-[#1a365d]" />
                                        <span className="text-sm font-black text-[#1a365d] uppercase tracking-wider">{role}</span>
                                    </div>
                                ))}
                                {roles.length === 0 && (
                                    <p className="text-sm text-slate-400 font-bold italic">Standard Staff Access</p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-8">
                        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm space-y-8">
                            <div className="border-b border-slate-100 pb-6">
                                <h2 className="text-xl font-black text-[#1a365d] font-outfit">Security Settings</h2>
                                <p className="text-sm text-slate-400 font-medium">Manage your password and authentication methods.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <Lock size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Change Password</h4>
                                            <p className="text-xs text-slate-500">Update your university portal password.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsChangingPassword(true)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                                    >
                                        Update
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all opacity-60">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Two-Factor Authentication</h4>
                                            <p className="text-xs text-slate-500">Add an extra layer of security (Coming Soon).</p>
                                        </div>
                                    </div>
                                    <button disabled className="px-4 py-2 bg-slate-200 text-slate-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed">
                                        Enabled
                                    </button>
                                </div>
                            </div>
                        </div>

                        {isChangingPassword && (
                            <div className="bg-white border border-blue-200 rounded-3xl p-10 shadow-xl space-y-8 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                                    <h3 className="text-xl font-black text-[#1a365d] font-outfit">Update Password</h3>
                                    <button onClick={() => { setIsChangingPassword(false); setPwdStatus({ loading: false, error: null, success: false }); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                                </div>

                                {pwdStatus.error && (
                                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                                        <ShieldAlert size={16} /> {pwdStatus.error}
                                    </div>
                                )}

                                {pwdStatus.success && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                                        <ShieldCheck size={16} /> Password updated successfully!
                                    </div>
                                )}

                                <form className="space-y-6" onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (passwordData.newPassword !== passwordData.confirmPassword) {
                                        return setPwdStatus({ ...pwdStatus, error: "Passwords do not match." });
                                    }
                                    setPwdStatus({ ...pwdStatus, loading: true, error: null });
                                    const result = await changePassword({
                                        currentPassword: passwordData.currentPassword,
                                        newPassword: passwordData.newPassword
                                    });
                                    if (result.success) {
                                        setPwdStatus({ loading: false, error: null, success: true });
                                        setTimeout(() => setIsChangingPassword(false), 2000);
                                    } else {
                                        setPwdStatus({ loading: false, error: result.error || "Update failed", success: false });
                                    }
                                }}>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Current Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={passwordData.currentPassword}
                                                onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={passwordData.newPassword}
                                                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Confirm New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={passwordData.confirmPassword}
                                                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            type="submit"
                                            disabled={pwdStatus.loading}
                                            className="flex-1 bg-[#1a365d] text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50"
                                        >
                                            {pwdStatus.loading ? "Updating..." : "Confirm Update"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsChangingPassword(false)}
                                            className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm space-y-8">
                        <div className="border-b border-slate-100 pb-6">
                            <h2 className="text-xl font-black text-[#1a365d] font-outfit">Notification Preferences</h2>
                            <p className="text-sm text-slate-400 font-medium">Choose how and when you want to be notified.</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'Email Alerts', description: 'Receive memo updates via university email.', active: true },
                                { label: 'In-System Notifications', description: 'Visible alerts when logged into the dashboard.', active: true },
                                { label: 'Approval Reminders', description: 'Be reminded of pending approvals every 24 hours.', active: false },
                                { label: 'Marketing Communications', description: 'Receive news about system updates and features.', active: false },
                            ].map((pref, i) => (
                                <div key={i} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-2xl transition-all">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-900">{pref.label}</h4>
                                        <p className="text-xs text-slate-500">{pref.description}</p>
                                    </div>
                                    <div className={cn(
                                        "w-12 h-6 rounded-full p-1 transition-all cursor-pointer",
                                        pref.active ? "bg-blue-600" : "bg-slate-200"
                                    )}>
                                        <div className={cn(
                                            "w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                                            pref.active ? "translate-x-6" : "translate-x-0"
                                        )} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Global Policy Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 flex items-start gap-5 shadow-sm">
                    <AlertIcon className="text-amber-600 shrink-0 mt-1" size={24} />
                    <div className="space-y-2">
                        <h3 className="text-lg font-black text-amber-900 font-outfit">Data Integrity Policy</h3>
                        <p className="text-sm text-amber-800 font-medium leading-relaxed">
                            Profile details and departmental assignments are synchronized with the Central University Registry.
                            For corrections regarding your name, department, or staff ID, please contact the **Directorate of ICT** at Cosmopolitan University Abuja.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

const X = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
