import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Transitioned to Application Default Credentials (ADC) to ensure stability 
 * without requiring manual JSON key files.
 */

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    // Mission Registry Handshake: Utilizing environment ADC nodes
    return initializeApp({
      projectId: "studio-2134942499-abd6c",
      databaseURL: "https://studio-2134942499-abd6c-default-rtdb.firebaseio.com"
    });
  } catch (e) {
    console.error("CRITICAL: Admin SDK Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue };
