
import * as admin from 'firebase-admin';

/**
 * @fileOverview Standardized Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake.
 * Explicitly binds to the mission project ID to prevent token fetch failures.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  try {
    // Mission Handshake Node: Explicit Project ID binding for stable metadata lookup
    return admin.initializeApp({
      projectId: "studio-2134942499-abd6c"
    });
  } catch (e) {
    console.error("CRITICAL: Admin SDK Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export const FieldValue = admin.firestore.FieldValue;
