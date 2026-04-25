import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered to resolve identity pulse issues in Studio/Local environments.
 * Optimized to utilize explicit service account credentials from environment variables.
 */

function getAdminApp() {
  // Registry Pulse: Ensure singleton app instance
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  // Registry Sync: Prioritize explicit Service Account if provided as stringified JSON in .env
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  
  if (saJson) {
    try {
      const sa = JSON.parse(saJson);
      return admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || projectId
      });
    } catch (e) {
      console.warn("Manual Service Account Node Handshake Failed. Checking ADC...");
    }
  }

  try {
    /**
     * REGISTRY HANDSHAKE:
     * Attempt to resolve identity via Application Default Credentials (ADC).
     * This handshakes with GOOGLE_APPLICATION_CREDENTIALS file path if set in .env.
     */
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId,
    });
  } catch (e) {
    console.warn("ADC Handshake Failure. Falling back to Project ID node.");
    // Fallback node: Initialize with Project ID only (may restrict certain Auth operations)
    return admin.initializeApp({
      projectId: projectId,
    });
  }
}

const app = getAdminApp();

// Explicitly bind services to the app instance to ensure authorized handshake
export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
export const FieldValue = admin.firestore.FieldValue;
