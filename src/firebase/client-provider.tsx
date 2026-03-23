'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { app, auth, firestore, functions } from '@/firebase';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider firebaseApp={app} auth={auth} firestore={firestore} functions={functions}>
      {children}
    </FirebaseProvider>
  );
}
