'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  MongoStoreError,
  DocumentSnapshot,
} from '@/lib/mongo-store';
import { errorEmitter } from '@/mongodb/error-emitter';
import { MongoPermissionError } from '@/mongodb/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: MongoStoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single MongoStore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The MongoStore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<MongoStoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Optional: setData(null); // Clear previous data instantly

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          // Document does not exist
          setData(null);
        }
        setError(null); // Clear any previous error on successful snapshot (even if doc doesn't exist)
        setIsLoading(false);
      },
      (error: MongoStoreError) => {
        const isPermission = (error as any)?.status === 403 || error?.message?.includes('Permission denied');
        const contextualError = isPermission
          ? new MongoPermissionError({
              operation: 'get',
              path: memoizedDocRef.path,
            })
          : error;

        setError(contextualError)
        setData(null)
        setIsLoading(false)

        if (isPermission) {
          errorEmitter.emit('permission-error', contextualError as MongoPermissionError);
        } else {
          console.error(`MongoDB error at ${memoizedDocRef.path}:`, error);
        }
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef]); // Re-run if the memoizedDocRef changes.

  if(memoizedDocRef && !memoizedDocRef.__memo) {
    throw new Error(memoizedDocRef + ' was not properly memoized using useMemoMongo');
  }

  return { data, isLoading, error };
}

