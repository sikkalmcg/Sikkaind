'use client';

import React, { ReactNode } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import app from './config'; // Import the initialized app

import { 
  FirebaseAppProvider,
  AuthProvider,
  FirestoreProvider,
  FunctionsProvider,
  useFirebaseApp,
  useAuth,
  useFirestore,
  useFunctions,
  useUser,
  useFirestoreCollectionData,
  useFirestoreDocData
} from 'reactfire';

// Re-exporting reactfire hooks for convenience
export {
    useFirebaseApp, 
    useAuth, 
    useFirestore, 
    useFunctions, 
    useUser, 
    useFirestoreCollectionData as useCollection,
    useFirestoreDocData as useDoc
};

export { AppProvider, useAppContext } from './app-provider';

// Main FirebaseProvider setup
interface FirebaseProviderProps {
  children: ReactNode;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children }) => {
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const functions = getFunctions(app);

  return (
    <FirebaseAppProvider firebaseApp={app}>
      <AuthProvider sdk={auth}>
        <FirestoreProvider sdk={firestore}>
          <FunctionsProvider sdk={functions}>
            {children}
          </FunctionsProvider>
        </FirestoreProvider>
      </AuthProvider>
    </FirebaseAppProvider>
  );
};
