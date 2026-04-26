
import * as admin from 'firebase-admin';

// Re-engineered to be more explicit about credential requirements.
// This will fail loudly if the service account JSON is missing or invalid.

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. This is required for server-side authentication.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Make sure it is a valid JSON string.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const app = initializeAdminApp();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
export const FieldValue = admin.firestore.FieldValue;
