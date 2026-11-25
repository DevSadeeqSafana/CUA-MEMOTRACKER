'use client';

import { Download } from 'lucide-react';
import { Parser } from 'json2csv';
import toast from 'react-hot-toast';
import type { FinanceObligation } from '@/lib/finance-report';

/** Downloads every memo in the (filtered) finance report as a CSV file. */
export default function FinanceExportButton({ rows }: { rows: FinanceObligation[] }) {
    const handleExport = () => {
        try {
            const parser = new Parser({
                fields: [
                    { label: 'Reference', value: 'reference' },
                    { label: 'Memo Title', value: 'title' },
                    { label: 'Department', value: 'department' },
                    { label: 'Budget Category', value: 'category' },
                    { label: 'Payee', value: 'payee' },
                    { label: 'Status', value: 'status' },
                    { label: 'Expected (NGN)', value: (r: FinanceObligation) => r.expected.toFixed(2) },
                    { label: 'Paid (NGN)', value: (r: FinanceObligation) => r.paid.toFixed(2) },
                    { label: 'Outstanding (NGN)', value: (r: FinanceObligation) => r.balance.toFixed(2) },
                    { label: 'Payments', value: 'paymentCount' },
                    { label: 'Sent to Accountant', value: (r: FinanceObligation) => r.routedAt.slice(0, 10) },
                    { label: 'Days in Queue', value: 'daysSinceRouted' },
                ],
            });
            const csv = parser.parse(rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Finance_Report_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Finance report exported');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export the report.');
        }
    };

    return (
        <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b2a5b] hover:bg-[#1a5aa6] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-md disabled:opacity-40"
        >
            <Download size={13} />
            Export CSV
        </button>
    );
}
