'use client';

import { Download } from 'lucide-react';
import { Parser } from 'json2csv';
import toast from 'react-hot-toast';

export default function ExportButton({ data }: { data: any[] }) {
    const handleExport = () => {
        try {
            const fields = [
                'reference_number',
                'title',
                'creator_name',
                'department',
                'status',
                'created_at'
            ];
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(data);

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `MemoTracker_Report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Report exported successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export report.');
        }
    };

    return (
        <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-[#1a365d] text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-blue-900/10 hover:bg-blue-800 transition-all font-outfit uppercase tracking-wider"
        >
            <Download size={18} />
            Export Data
        </button>
    );
}
