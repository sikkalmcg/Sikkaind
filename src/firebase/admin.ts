
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

/**
 * @fileOverview Firebase Admin SDK initialization node.
 * Provides privileged access for user management and system-level operations.
 */

const config = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-2134942499-abd6c",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  admin.initializeApp({
    credential: config.clientEmail && config.privateKey 
      ? admin.credential.cert(config as admin.ServiceAccount)
      : admin.credential.applicationDefault(),
    databaseURL: `https://${config.projectId}-default-rtdb.firebaseio.com`
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export { adminAuth, adminDb, FieldValue, config };
