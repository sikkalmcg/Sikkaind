
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Synchronized with the serviceAccountKey.json manifest for secure identity provisioning.
 * Uses singleton pattern with explicit certificate handshake.
 */

const app = (getApps().length === 0)
  ? initializeApp({
      credential: cert(serviceAccount),
    })
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
