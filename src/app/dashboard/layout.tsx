import { auth, signOut } from '@/auth';
import Sidebar from '@/components/layout/Sidebar';
import GlobalSearch from '@/components/layout/GlobalSearch';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';

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
        <div className="min-h-screen bg-[#f4f7fb] text-slate-900 overflow-hidden font-sans relative">
            <Sidebar userRoles={userRoles} />

            {/* Main Content Area - Shifted for fixed sidebar */}
            <main className="md:pl-72 w-full flex flex-col min-h-screen h-screen overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,#dde9f6_0%,#eef3fa_40%,#f4f7fb_75%)] relative pt-16 md:pt-0">
                {/* Top bar: global search, notifications and account menu; sticky while the page scrolls */}
                <header className="sticky top-0 z-30 bg-white/75 backdrop-blur-md border-b border-slate-200/70">
                    <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 h-16 flex items-center gap-3">
                        <GlobalSearch />
                        <div className="ml-auto flex items-center gap-2">
                            <NotificationBell />
                            <UserMenu
                                name={session?.user?.name}
                                email={session?.user?.email}
                                roles={userRoles}
                                handleSignOut={handleSignOut}
                            />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-grow p-4 md:p-8 lg:p-10 scroll-smooth">
                    <div className="max-w-[1400px] mx-auto pb-10">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
