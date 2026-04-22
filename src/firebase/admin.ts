
import * as admin from 'firebase-admin';

/**
 * @fileOverview Standardized Firebase Admin SDK Node.
 * Uses the most reliable initialization pattern for Application Default Credentials (ADC).
 * Avoids rigid project ID binding to prevent metadata handshake failures.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  try {
    // Attempt standard initialization (ADC)
    return admin.initializeApp();
  } catch (e) {
    // Fallback attempt for specific environment nodes
    try {
        return admin.initializeApp({
            projectId: "studio-2134942499-abd6c"
        });
    } catch (innerError) {
        console.error("CRITICAL: Admin SDK Handshake Failure", innerError);
        return null;
    }
  }
}

const app = getAdminApp();

export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export const FieldValue = admin.firestore.FieldValue;
