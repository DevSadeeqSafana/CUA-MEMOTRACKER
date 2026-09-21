'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

if (!GOOGLE_CLIENT_ID) {
  // Falling back to a different project's client id only produces confusing
  // origin_mismatch errors; fail loudly instead.
  console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set - Google Sign-In will not work.');
}

export default function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
