'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// True once the user has moved between pages inside the app in this tab, i.e. router.back()
// stays in the app. Module state survives client-side navigations but not full reloads,
// which is exactly when "back" might leave the app (e.g. a memo opened from an email link).
let hasInAppHistory = false;

export function canGoBackInApp() {
    return hasInAppHistory;
}

/** Mount once in the dashboard shell. */
export function useTrackInAppNavigation() {
    const pathname = usePathname();
    const first = useRef(pathname);
    useEffect(() => {
        if (pathname !== first.current) hasInAppHistory = true;
    }, [pathname]);
}
