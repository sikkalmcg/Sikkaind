
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from '@/serviceAccountKey.json';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Implements modern modular initialization node with explicit service account handshake.
 */

const app = !getApps().length
  ? initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    })
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
