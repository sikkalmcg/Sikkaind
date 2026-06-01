'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { MongoStore } from '@/lib/mongo-store';
import { MongoAuth, MongoUser } from '@/mongodb/session-auth';
import { MongoErrorListener } from '@/components/MongoErrorListener';

interface MongoProviderProps {
  children: ReactNode;
  mongoStore: MongoStore;
  auth: MongoAuth;
}

interface UserAuthState {
  user: MongoUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface MongoContextState {
  areServicesAvailable: boolean;
  mongoStore: MongoStore | null;
  auth: MongoAuth | null;
  user: MongoUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface MongoServicesAndUser {
  mongoStore: MongoStore;
  auth: MongoAuth;
  user: MongoUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult {
  user: MongoUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const MongoContext = createContext<MongoContextState | undefined>(undefined);

export const MongoProvider: React.FC<MongoProviderProps> = ({ children, mongoStore, auth }) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const unsubscribe = auth.onAuthStateChanged(
      (mongoUser) => {
        setUserAuthState({ user: mongoUser, isUserLoading: false, userError: null });
      },
      (error) => {
        console.error('MongoProvider: auth state error:', error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      },
    );

    return () => unsubscribe();
  }, [auth]);

  const contextValue = useMemo((): MongoContextState => {
    const servicesAvailable = !!(mongoStore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      mongoStore: servicesAvailable ? mongoStore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [mongoStore, auth, userAuthState]);

  return (
    <MongoContext.Provider value={contextValue}>
      <MongoErrorListener />
      {children}
    </MongoContext.Provider>
  );
};

export const useMongo = (): MongoServicesAndUser => {
  const context = useContext(MongoContext);
  if (context === undefined) {
    throw new Error('useMongo must be used within a MongoProvider.');
  }
  if (!context.areServicesAvailable || !context.mongoStore || !context.auth) {
    throw new Error('MongoDB services not available. Check MongoProvider props.');
  }
  return {
    mongoStore: context.mongoStore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

export const useAuth = (): MongoAuth => {
  const { auth } = useMongo();
  return auth;
};

export const useMongoStore = (): MongoStore => {
  const { mongoStore } = useMongo();
  return mongoStore;
};

type MemoMongo<T> = T & { __memo?: boolean };

export function useMemoMongo<T>(factory: () => T, deps: React.DependencyList): T | MemoMongo<T> {
  return React.useMemo(() => {
    const memoized = factory();
    if (typeof memoized === 'object' && memoized !== null) {
      Object.defineProperty(memoized, '__memo', { value: true, enumerable: false, configurable: true });
    }
    return memoized;
  }, deps);
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useMongo();
  return { user, isUserLoading, userError };
};
