
import * as admin from 'firebase-admin';
import { getApps, initializeApp, credential } from 'firebase-admin/app';
import serviceAccount from '@/serviceAccountKey.json';

/**
 * @fileOverview Refined Firebase Admin SDK Handshake.
 * Implements a hardened singleton pattern with explicit service account credentials.
 */

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    return initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
    });
  } catch (e) {
    console.error("Critical: Admin SDK Registry Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue };
