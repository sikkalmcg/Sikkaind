
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { useMemo } from 'react';

// Initialize Firebase singleton instances for client-side use
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

// Export instances directly for use in components like the Login page
export { app, auth, firestore };

/**
 * Initialization function used by the FirebaseClientProvider.
 */
export function initializeFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  return { app, auth, firestore };
}

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T {
  return useMemo(factory, deps);
}

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export { firebaseConfig };
