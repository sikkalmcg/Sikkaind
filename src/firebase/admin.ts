import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Strictly utilizes modular-safe initialization with explicit Project ID fallback.
 */

function getAdminApp() {
  // Return existing instance if pulse is already active
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    // Attempt standard ADC initialization
    return admin.initializeApp();
  } catch (e) {
    try {
        // Fallback: Explicitly map Project ID to resolve metadata handshake issues
        return admin.initializeApp({
            projectId: projectId,
        });
    } catch (e2) {
        console.error("FATAL: Identity Registry Handshake Failure", e2);
        return null;
    }
  }
}

const app = getAdminApp();

// Explicitly bind services to the app instance to ensure authorized handshake
export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export const FieldValue = admin.firestore.FieldValue;
