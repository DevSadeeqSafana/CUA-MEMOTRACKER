'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `fn` now, then every `intervalMs` while the tab is visible. A hidden tab
 * stops polling and catches up as soon as it is shown again. Only one call runs
 * at a time: Next.js runs a page's server actions one after another, so overlapping
 * polls would delay the user's own clicks.
 */
export function useVisiblePolling(fn: () => Promise<unknown>, intervalMs: number, deps: unknown[] = []) {
    const fnRef = useRef(fn);
    useEffect(() => { fnRef.current = fn; });

    useEffect(() => {
        let running = false;
        let timer: ReturnType<typeof setInterval> | null = null;
        const tick = async () => {
            if (running || document.visibilityState !== 'visible') return;
            running = true;
            try { await fnRef.current(); } catch (e) { console.error('Polling failed:', e); } finally { running = false; }
        };
        const start = () => { if (!timer) timer = setInterval(tick, intervalMs); };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') { tick(); start(); } else stop();
        };
        tick();
        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs, ...deps]);
}
