import Link from 'next/link';
import Image from 'next/image';
import {
    FileText,
    PlusCircle,
    Inbox,
    CheckSquare,
    BarChart2,
    Settings,
    LogOut,
} from 'lucide-react';
import { auth, signOut } from '@/auth';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const userRoles = (session?.user as any)?.role || [];

    async function handleSignOut() {
        'use server';
        await signOut();
    }

    return (
        <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
            <Sidebar user={session?.user} userRoles={userRoles} handleSignOut={handleSignOut} />

            {/* Main Content */}
            <main className="flex-grow flex flex-col overflow-hidden bg-slate-50 relative pt-16 md:pt-0 h-screen transition-all">
                {/* Page Content */}
                <div className="flex-grow overflow-auto p-4 md:p-10 scroll-smooth">
                    <div className="max-w-[1400px] mx-auto pb-10">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
