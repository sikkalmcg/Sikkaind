
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Configuration: Uses Application Default Credentials (ADC) node.
 * Eliminates dependency on local JSON manifests for environment stability.
 */

const app = (getApps().length === 0)
  ? initializeApp() 
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
