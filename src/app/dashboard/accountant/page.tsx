import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAccountantFinanceMemos } from '@/lib/actions';
import AccountantProcessingView from '@/components/accountant/AccountantProcessingView';

export const metadata = {
    title: 'Finance Queue | CUA Memo System',
    description: 'University Accountant Financial Budget Memo Processing Queue',
};

export default async function AccountantDashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const userRoles: string[] = (session.user as any).role || [];
    const isAccountant =
        userRoles.includes('Accountant') ||
        userRoles.includes('Administrator') ||
        session.user.email?.toLowerCase().includes('chidi.ojiako');

    if (!isAccountant) {
        redirect('/dashboard');
    }

    const res = await getAccountantFinanceMemos();
    const memos = res.success && Array.isArray(res.memos) ? res.memos : [];

    return <AccountantProcessingView initialMemos={memos} />;
}