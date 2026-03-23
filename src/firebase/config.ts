import { initializeApp, getApps, getApp } from "firebase/app";

export const firebaseConfig = {
  "projectId": "studio-2134942499-abd6c",
  "appId": "1:852873708191:web:6d4d17b1aa4ee474d158aa",
  "apiKey": "AIzaSyDkEktvsr9sIkfV2EO2QVYE7ud_AzozoIs",
  "authDomain": "studio-2134942499-abd6c.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "852873708191"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export default app;
