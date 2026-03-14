import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDkEktvsr9sIkfV2EO2QVYE7ud_AzozoIs",
  authDomain: "studio-2134942499-abd6c.firebaseapp.com",
  projectId: "studio-2134942499-abd6c",
  storageBucket: "studio-2134942499-abd6c.firebasestorage.app",
  messagingSenderId: "852873708191",
  appId: "1:852873708191:web:6d4d17b1aa4ee474d158aa"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
