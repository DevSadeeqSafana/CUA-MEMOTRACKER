'use client';

import { useEffect } from 'react';
import { markMemoAsRead } from '@/lib/actions';

export default function MarkAsRead({ memoId }: { memoId: number }) {
    useEffect(() => {
        markMemoAsRead(memoId);
    }, [memoId]);

    return null;
}
