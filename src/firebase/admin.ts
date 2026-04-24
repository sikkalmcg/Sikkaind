import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Optimized to use environment-level credentials to resolve token payload errors.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    /**
     * REGISTRY HANDSHAKE:
     * In this environment, we initialize without explicit certs to allow
     * the Google Auth library to resolve the workstation pulse automatically.
     */
    return admin.initializeApp({
      projectId: projectId,
    });
  } catch (e) {
    console.error("FATAL: Identity Registry Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

// Explicitly bind services to the app instance to ensure authorized handshake
export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export const FieldValue = admin.firestore.FieldValue;
