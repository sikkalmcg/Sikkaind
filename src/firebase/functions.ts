'use client';

import { useFunctions } from '@/firebase/provider';
import { httpsCallable as originalHttpsCallable, HttpsCallable } from 'firebase/functions';
import { useMemo } from 'react';

/**
 * A hook to get a memoized Cloud Function instance.
 * 
 * @param name The name of the function.
 * @returns A memoized Cloud Function instance.
 */
export function useCallable<RequestData = unknown, ResponseData = unknown>(name: string): HttpsCallable<RequestData, ResponseData> {
  const functions = useFunctions();

  const callable = useMemo(() => 
    originalHttpsCallable<RequestData, ResponseData>(functions, name), 
    [functions, name]
  );

  return callable;
}
