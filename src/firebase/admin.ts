
import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Uses a singleton pattern with a robust check for existing apps.
 * Utilizes environment-level Application Default Credentials (ADC).
 */

const projectId = "studio-2134942499-abd6c";

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  try {
    return admin.initializeApp({
      projectId: projectId
    });
  } catch (e) {
    console.error("CRITICAL: Admin SDK Handshake Failure", e);
    // In case of secondary initialization failure, return the first app if it exists
    return admin.apps.length > 0 ? admin.apps[0] : null;
  }
}

const app = getAdminApp();

if (!app) {
    throw new Error("Registry Control Node: Admin SDK failed to initialize.");
}

const adminAuth = admin.auth(app);
const adminDb = admin.firestore(app);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue };
