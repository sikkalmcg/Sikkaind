import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * @fileOverview Refined Firebase Admin SDK Handshake.
 * Utilizing Application Default Credentials (ADC) for environment-level auth.
 */

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    return initializeApp();
  } catch (e) {
    console.error("Critical: Admin SDK Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue };
