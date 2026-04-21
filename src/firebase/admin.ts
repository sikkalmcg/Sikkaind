
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Hardened Firebase Admin SDK Registry.
 * Decoupled from physical JSON files to utilize Application Default Credentials (ADC).
 * Ensures mission continuity in cloud-hosted environments without local credential dependencies.
 */

const projectId = "studio-2134942499-abd6c";

const app = (getApps().length === 0)
  ? initializeApp({
      projectId: projectId,
      // In Firebase Studio/GCP environments, omitting credentials 
      // allows the SDK to automatically resolve authorization via metadata server.
    })
  : getApp();

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { adminAuth, adminDb, FieldValue };
