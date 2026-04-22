import * as admin from 'firebase-admin';

/**
 * @fileOverview Hardened Firebase Admin SDK Node.
 * Re-engineered for high-reliability cloud handshake in Studio environments.
 * Updated: Now utilizes explicit Service Account credentials to bypass metadata errors.
 */

function getAdminApp() {
  // Agar app pehle se initialized hai, toh wahi return karo
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = "studio-2134942499-abd6c";

  try {
    /**
     * IMPORTANT: 'service-key.json' wahi file hai jo aapne Google Cloud se download ki hai.
     * Ensure karein ki ye file 'admin.ts' ke saath same directory mein ho.
     */
    const serviceAccount = require("./service-key.json");

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  } catch (e) {
    /**
     * Handshake failure backup: 
     * Agar JSON file nahi milti toh ye fallback try karega, 
     * lekin best results ke liye JSON file zaroori hai.
     */
    try {
      console.warn("Service Account file not found, attempting ADC fallback...");
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