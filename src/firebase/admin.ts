import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Optimized to use environment-level credentials to resolve token payload errors.
 */

function getAdminApp() {
  // Registry Pulse: Ensure singleton app instance
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    /**
     * REGISTRY HANDSHAKE:
     * Explicitly invoke applicationDefault() to ensure the SDK handshakes 
     * correctly with the workstation's identity node.
     */
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId,
    });
  } catch (e) {
    // Fallback: Attempt basic init if metadata pulse is unstable
    console.warn("Registry Handshake Fallback Triggered.");
    return admin.initializeApp({
      projectId: projectId,
    });
  }
}

const app = getAdminApp();

// Explicitly bind services to the app instance to ensure authorized handshake
export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export const FieldValue = admin.firestore.FieldValue;
