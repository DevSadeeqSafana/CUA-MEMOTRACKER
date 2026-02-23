export const dynamic = 'force-dynamic';
import { getRecipients } from '@/lib/actions';
import NewMemoClient from './NewMemoClient';

export default async function NewMemoPage() {
    const recipients = await getRecipients();

    return (
        <div className="container mx-auto pb-10">
            <NewMemoClient recipients={recipients} />
        </div>
    );
}
