import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Synchronized with the serviceAccountKey.json manifest for secure identity provisioning.
 * Using singleton pattern to prevent "App already exists" errors during HMR.
 */

const app = (getApps().length === 0)
  ? initializeApp({
      credential: cert(serviceAccount),
    })
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
