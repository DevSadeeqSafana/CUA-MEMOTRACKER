export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { Building2 } from 'lucide-react';
import { canManageVendors, listVendorRecords } from '@/lib/vendor-data';
import { canViewFinanceReports, getFinanceReport } from '@/lib/finance-report';
import VendorDirectory, { type VendorTotals } from '@/components/vendors/VendorDirectory';

export const metadata = {
    title: 'Vendors | CUA Memo System',
    description: 'Registered vendors shared with the Staff Portal',
};

export default async function VendorsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return null;

    const manager = canManageVendors(session);
    const seesMoney = canViewFinanceReports(session);
    const sp = await searchParams;
    const search = (sp.q || '').slice(0, 100);
    // Only Finance sees deactivated vendors
    const status = manager && (sp.status === 'inactive' || sp.status === 'all') ? sp.status : 'active';

    const [vendors, report] = await Promise.all([
        listVendorRecords({ search, status }),
        seesMoney ? getFinanceReport() : Promise.resolve(null),
    ]);

    const totals: Record<number, VendorTotals> = {};
    for (const row of report?.byVendor ?? []) {
        if (row.vendorId) totals[row.vendorId] = { memos: row.memos, expected: row.expected, paid: row.paid, outstanding: row.outstanding };
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 bg-[#0b2a5b] text-white flex items-center justify-center shrink-0 rounded-full ring-2 ring-[#e3ac3a]/70 ring-offset-2">
                        <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-3xl font-medium tracking-tight text-[#0b2a5b] font-display">Vendor Management</h1>
                        <p className="text-xs text-slate-500 font-medium">
                            Registered vendors, shared with the Staff Portal.{' '}
                            {manager ? 'You can register, edit and deactivate vendors.' : 'Finance manages vendor records.'}
                        </p>
                    </div>
                </div>
            </div>

            <VendorDirectory
                vendors={vendors}
                totals={seesMoney ? totals : null}
                canManage={manager}
                search={search}
                status={status}
            />
        </div>
    );
}
