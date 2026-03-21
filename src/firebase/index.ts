import { getFirestore } from 'firebase/firestore';
import app from './config';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { useUser, useFirestore, useFunctions, useAuth, FirebaseProvider } from "./provider";
import { useCollection } from "./firestore/use-collection";
import { useDoc } from "./firestore/use-doc";
import { useCallable } from "./functions";
import { useMemoFirebase } from './memo';

const firestore = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

export {
    // Client-side hooks and providers
    useUser,
    useFirestore,
    useFunctions,
    useAuth,
    FirebaseProvider,
    useCollection,
    useDoc,
    useCallable,
    useMemoFirebase,

    // Firebase services
    app,
    auth,
    firestore,
    functions,
};
