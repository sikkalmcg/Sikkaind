import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Core Firebase SDK Initialization Node.
 * Decoupled from barrel files to prevent circular dependency triggers.
 * Safe for use in both Client Components and Server-side modules.
 */

export function initializeFirebase() {
  let app: FirebaseApp;
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      app = getApp();
    }
  } else {
    app = getApp();
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  return { firebaseApp: app, auth, firestore };
}

// Registry Instance Node: Pre-initialize for non-hook usage
const services = initializeFirebase();
export const firebaseApp = services.firebaseApp;
export const auth = services.auth;
export const firestore = services.firestore;

export function getSdks(appInstance: FirebaseApp) {
  return {
    firebaseApp: appInstance,
    auth: getAuth(appInstance),
    firestore: getFirestore(appInstance)
  };
}
