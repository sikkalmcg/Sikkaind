
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
    // REGISTRY HANDSHAKE Node: In Google Cloud Workstations (Studio), 
    // we should prioritize ambient credentials if explicit keys are missing.
    
    if (config.clientEmail && config.privateKey) {
        return initializeApp({
          credential: admin.credential.cert(config as admin.ServiceAccount),
          databaseURL: `https://${config.projectId}-default-rtdb.firebaseio.com`
        });
    }

    // Default Node: Fallback to ambient service account / project config
    return initializeApp({
        projectId: config.projectId,
        databaseURL: `https://${config.projectId}-default-rtdb.firebaseio.com`
    });

  } catch (e) {
    console.error("Critical: Admin SDK Registry Handshake Failure", e);
    return null;
  }
}

const app = getAdminApp();

// MISSION CRITICAL: Ensure SDK instances are correctly initialized
const adminAuth = admin.auth(app as any);
const adminDb = admin.firestore(app as any);
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue, config };
