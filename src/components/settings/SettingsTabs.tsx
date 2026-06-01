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
    EyeOff,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { changePassword } from '@/lib/actions';
import toast from 'react-hot-toast';

interface SettingsTabsProps {
    user: any;
    roles: string[];
}

export default function SettingsTabs({ user, roles }: SettingsTabsProps) {
    const [activeTab, setActiveTab] = useState('profile');
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdStatus, setPwdStatus] = useState<{ loading: boolean }>({
        loading: false,
    });

    const tabs = [
        { id: 'profile', label: 'Personal Profile', icon: User },
        { id: 'password', label: 'Change Password', icon: Lock },
        { id: 'notifications', label: 'Alert Preferences', icon: Bell },
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col font-sans animate-in fade-in duration-500">
            {/* Topbar: Tab Specific Title & Description */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                            {activeTab === 'profile' && <User size={18} />}
                            {activeTab === 'password' && <Lock size={18} />}
                            {activeTab === 'notifications' && <Bell size={18} />}
                        </div>
                        <h2 className="text-lg font-black text-[#1a365d] uppercase tracking-tight font-outfit">
                            {activeTab === 'profile' ? 'Official Profile' : activeTab === 'password' ? 'Change Password' : 'Alert Preferences'}
                        </h2>
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-11">
                        {activeTab === 'profile' && 'Verified information from the University Registry'}
                        {activeTab === 'password' && 'Update your university portal password'}
                        {activeTab === 'notifications' && 'Configure active dispatch methods and reminders'}
                    </p>
                </div>
            </div>

            {/* Horizontal Tabs List (Gmail style) */}
            <div className="flex border-b border-slate-100 overflow-x-auto select-none shrink-0 scrollbar-none bg-white">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                            }}
                            className={cn(
                                "flex items-center gap-3 px-6 py-4.5 border-b-2 font-black text-xs uppercase tracking-widest transition-all shrink-0 relative",
                                isActive
                                    ? "border-blue-600 text-blue-600 bg-blue-50/20"
                                    : "border-transparent text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Active Content Body */}
            <div className="p-6 md:p-8 space-y-8 flex-grow">
                {activeTab === 'profile' && (
                    <div className="space-y-8">
                        {/* Parameter Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-slate-50/40 border border-slate-100 rounded-3xl p-6 md:p-8">
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

                        {/* Access Control list */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-[#1a365d] uppercase tracking-[0.2em] pl-1">Authorized Roles</h3>
                            <div className="flex flex-wrap gap-4">
                                {roles.map((role: string) => (
                                    <div key={role} className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-100 rounded-2xl transition-all hover:bg-blue-100">
                                        <Shield size={18} className="text-[#1a365d]" />
                                        <span className="text-xs font-black text-[#1a365d] uppercase tracking-wider">{role}</span>
                                    </div>
                                ))}
                                {roles.length === 0 && (
                                    <p className="text-sm text-slate-400 font-bold italic pl-1">Standard Staff Access</p>
                                )}
                            </div>
                        </div>

                        {/* Global Policy Note */}
                        <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 md:p-8 flex items-start gap-4 md:gap-5 shadow-sm">
                            <AlertIcon className="text-amber-600 shrink-0 mt-1" size={20} />
                            <div className="space-y-2">
                                <h3 className="text-xs font-black text-amber-900 font-outfit uppercase tracking-wider">Data Integrity Policy</h3>
                                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                                    Profile details and departmental assignments are synchronized with the Central University Registry.
                                    For corrections regarding your name, department, or staff ID, please contact the **Directorate of ICT** at Cosmopolitan University Abuja.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'password' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Interactive Password Change Form */}
                        <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 md:p-8 space-y-6">
                            <form className="space-y-6" onSubmit={async (e) => {
                                e.preventDefault();
                                if (passwordData.newPassword !== passwordData.confirmPassword) {
                                    toast.error("Passwords do not match.");
                                    return;
                                }
                                setPwdStatus({ loading: true });
                                const result = await changePassword({
                                    currentPassword: passwordData.currentPassword,
                                    newPassword: passwordData.newPassword
                                });
                                if (result.success) {
                                    toast.success('Password updated successfully!');
                                    setPwdStatus({ loading: false });
                                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                } else {
                                    toast.error(result.error || "Update failed");
                                    setPwdStatus({ loading: false });
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
                                            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900 text-xs"
                                            placeholder="••••••••"
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
                                                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900 text-xs"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Confirm New Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={passwordData.confirmPassword}
                                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-6 font-bold outline-none focus:border-blue-500 transition-all text-slate-900 text-xs"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        type="submit"
                                        disabled={pwdStatus.loading}
                                        className="flex-1 bg-[#1a365d] text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-blue-800 transition-all disabled:opacity-50"
                                    >
                                        {pwdStatus.loading ? "Updating..." : "Update Password"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })}
                                        className="bg-slate-100 text-slate-500 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Secondary Security Box (2FA status) */}
                        <div className="flex items-center justify-between p-6 bg-slate-50/30 rounded-2xl border border-slate-100 opacity-60">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">Two-Factor Authentication</h4>
                                    <p className="text-xs text-slate-500">Add an extra layer of security (Coming Soon).</p>
                                </div>
                            </div>
                            <button disabled className="px-4 py-2 bg-slate-200 text-slate-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed">
                                Enabled
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="space-y-4">
                        {[
                            { label: 'Email Alerts', description: 'Receive memo updates via university email.', active: true },
                            { label: 'In-System Notifications', description: 'Visible alerts when logged into the dashboard.', active: true },
                            { label: 'Approval Reminders', description: 'Be reminded of pending approvals every 24 hours.', active: false },
                            { label: 'Marketing Communications', description: 'Receive news about system updates and features.', active: false },
                        ].map((pref, i) => (
                            <div key={i} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-slate-900 text-sm">{pref.label}</h4>
                                    <p className="text-xs text-slate-400 font-semibold">{pref.description}</p>
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
                )}
            </div>
        </div>
    );
}
