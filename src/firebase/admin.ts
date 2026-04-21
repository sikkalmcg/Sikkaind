
import * as admin from 'firebase-admin';
import { getApps, initializeApp, credential } from 'firebase-admin/app';

/**
 * @fileOverview Refined Firebase Admin SDK Handshake.
 * Implements a hardened singleton pattern to prevent token fetch failures in Studio environments.
 */

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-2134942499-abd6c";

const config = {
  projectId: projectId,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    // If explicit service account keys are provided, use them.
    // Otherwise, let the SDK infer credentials from the Cloud environment.
    const adminConfig = (config.clientEmail && config.privateKey)
      ? {
          credential: admin.credential.cert(config as admin.ServiceAccount),
          databaseURL: `https://${config.projectId}-default-rtdb.firebaseio.com`
        }
      : {
          projectId: config.projectId,
          databaseURL: `https://${config.projectId}-default-rtdb.firebaseio.com`
        };

    return initializeApp(adminConfig);
  } catch (e) {
    console.error("Critical: Admin SDK Registry Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();
const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue, config };
