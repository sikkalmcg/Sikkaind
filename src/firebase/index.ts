
// Import the functions to initialize Firebase services
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, type Auth } from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';

// --- CENTRALIZED HOOK EXPORTS ---
// This is the most important part. We are re-exporting all the custom hooks
// from the provider file. This ensures that any component that imports from '@/firebase'
// gets the correct, context-aware hooks.
export {
    useFirebase,
    useAuth,
    useFirestore,
    useFunctions,
    useUser,
    useMemoFirebase, // <-- Now exported
    useCollection    // <-- Now exported
} from './provider';

// --- FIREBASE INITIALIZATION ---

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase services
const app: FirebaseApp = initializeApp(firebaseConfig);
const firestore: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const auth: Auth = getAuth(app);
const functions: Functions = getFunctions(app); // <-- Was missing

// Export the initialized service instances for the FirebaseClientProvider
export {
    app,
    firestore,
    storage,
    auth,
    functions
};
