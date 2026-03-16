import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: "https://studio-2134942499-abd6c-default-rtdb.firebaseio.com",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton pattern: Check if app exists, if not initialize it
let app: FirebaseApp;
if (!getApps().length) {
  // Check if we have at least the API Key before initializing
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    app = initializeApp(firebaseConfig);
  } else {
    // This prevents the "default app does not exist" error during build
    app = {} as FirebaseApp; 
  }
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export { app };