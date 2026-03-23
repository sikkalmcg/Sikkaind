'''
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkEktvsr9sIkfV2EO2QVYE7ud_AzozoIs",
  authDomain: "studio-2134942499-abd6c.firebaseapp.com",
  databaseURL: "https://studio-2134942499-abd6c-default-rtdb.firebaseio.com",
  projectId: "studio-2134942499-abd6c",
  storageBucket: "studio-2134942499-abd6c.appspot.com",
  messagingSenderId: "852873708191",
  appId: "1:852873708191:web:6d4d17b1aa4ee474d158aa"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
'''