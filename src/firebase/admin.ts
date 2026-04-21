import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * @fileOverview Refined Firebase Admin SDK Handshake.
 * Utilizing Application Default Credentials (ADC) for environment-level auth.
 * This removes dependency on deleted serviceAccountKey.json.
 */

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    // Initializes with Application Default Credentials
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-2134942499-abd6c'
    });
  } catch (e) {
    console.error("Critical: Admin SDK Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue };
