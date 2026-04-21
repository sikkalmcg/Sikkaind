import * as admin from 'firebase-admin';

/**
 * @fileOverview Authorized Mission Control Node (Server-Side).
 * Handshakes with the Identity Platform via Application Default Credentials (ADC).
 * Hardened to utilize environment nodes without physical key manifests.
 */

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: "studio-2134942499-abd6c",
    });
  } catch (error) {
    console.error('Admin SDK Handshake Failure:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
