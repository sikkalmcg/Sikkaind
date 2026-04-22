import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Strictly utilizes modular-safe initialization with direct service binding.
 */

function getAdminApp() {
  // Return existing instance if pulse is already active
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    // Mission Registry Handshake: Modern initialization pattern
    // In Firebase App Hosting, projectId is usually enough to trigger ADC
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
