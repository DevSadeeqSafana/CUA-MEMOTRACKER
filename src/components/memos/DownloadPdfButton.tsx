'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/** Downloads the official PDF copy of a memo from /api/memos/:uuid/pdf. */
export default function DownloadPdfButton({ memoUuid }: { memoUuid: string }) {
    const [isLoading, setIsLoading] = useState(false);

    const download = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/memos/${memoUuid}/pdf`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to generate PDF');
            }
            const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] || 'memo.pdf';
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={download}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-medium text-white bg-[#0b2a5b] hover:bg-[#1a5aa6] px-3.5 py-2 rounded-xl shadow-sm shadow-[#0b2a5b]/20 transition-all disabled:opacity-60"
        >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {isLoading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
    );
}
