import * as admin from 'firebase-admin';

/**
 * @fileOverview Authorized Mission Control Node (Server-Side).
 * Handshakes with the Identity Platform via Application Default Credentials (ADC).
 * Decoupled from physical JSON manifests to prevent registry build failures.
 */

if (!admin.apps.length) {
  try {
    // Authorized environment pulse: utilizes ADC in Firebase Studio/Production environment
    admin.initializeApp();
  } catch (error) {
    console.error('Admin SDK Handshake Failure:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
