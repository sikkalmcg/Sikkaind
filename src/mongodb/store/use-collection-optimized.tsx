'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  MongoStoreError,
  QuerySnapshot,
  CollectionReference,
} from '@/lib/mongo-store';
import { errorEmitter } from '@/mongodb/error-emitter';
import { MongoPermissionError } from '@/mongodb/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionOptimizedResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: MongoStoreError | Error | null;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

// Global cache for collections to prevent re-fetching
const collectionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(query: any): string {
  if (query.type === 'collection') {
    return (query as CollectionReference).path;
  }
  return (query as unknown as InternalQuery)._query.path.canonicalString();
}

export function useCollectionOptimized<T = any>(
  memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean}) | null | undefined,
): UseCollectionOptimizedResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<MongoStoreError | Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getCacheKey(memoizedTargetRefOrQuery);
    const cached = collectionCache.get(cacheKey);
    
    // Use cache if available and fresh
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setData(cached.data);
        setIsLoading(false);
        setError(null);
      }
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        
        // Update cache
        collectionCache.set(cacheKey, { data: results, timestamp: Date.now() });
        
        if (isMountedRef.current) {
          setData(results);
          setError(null);
          setIsLoading(false);
        }
      },
      (error: MongoStoreError) => {
        const path: string =
          memoizedTargetRefOrQuery.type === 'collection'
            ? (memoizedTargetRefOrQuery as CollectionReference).path
            : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString()

        const contextualError = new MongoPermissionError({
          operation: 'list',
          path,
        })

        if (isMountedRef.current) {
          setError(contextualError)
          setData(null)
          setIsLoading(false)
        }

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoMongo');
  }

  return { data, isLoading, error };
}
