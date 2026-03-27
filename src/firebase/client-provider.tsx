
'use client';

import React, { ReactNode, useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const { app, auth, firestore } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
