'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '172821218711-pe2vgt64309g7pu0ftfo6oaja7e9bjdh.apps.googleusercontent.com';

export default function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
