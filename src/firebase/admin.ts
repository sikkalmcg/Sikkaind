
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Implements modern modular initialization node with explicit service account handshake.
 * Using relative import for serviceAccountKey to ensure resolution during production builds.
 */

const app = (getApps().length === 0)
  ? initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    })
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
