import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Strictly utilizes modular-safe initialization with fallback logic.
 */

function getAdminApp() {
  // Return existing instance if pulse is already active
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    // Mission Registry Handshake: Modern v12+ initialization pattern
    return admin.initializeApp({
      projectId: projectId,
      credential: admin.credential.applicationDefault()
    });
  } catch (e) {
    try {
        // Fallback Node: Minimal initialization if default credential fetch encounters latency
        return admin.initializeApp({
            projectId: projectId
        });
    } catch (innerError) {
        console.error("FATAL: Identity Registry Handshake Failure", innerError);
        return null;
    }
  }
}

const app = getAdminApp();

export const adminAuth = app ? admin.auth() : null;
export const adminDb = app ? admin.firestore() : null;
export const FieldValue = admin.firestore.FieldValue;
