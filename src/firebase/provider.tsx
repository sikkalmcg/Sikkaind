'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User } from 'firebase/auth';
import { Functions } from 'firebase/functions';
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
  useFirestoreCollectionData as useCollection, 
  useFirestoreDocData as useDoc
} from 'reactfire';

export { useFirebaseApp, useAuth, useFirestore, useFunctions, useUser, useCollection, useDoc };

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  functions: Functions;
}

export interface UserHookResult { 
  status: 'loading' | 'error' | 'success';
  data: User | null;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  functions
}) => {

  if (!firebaseApp || !firestore || !auth || !functions) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-bold text-red-400">Firebase Services not configured</p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseAppProvider firebaseApp={firebaseApp}>
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

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
