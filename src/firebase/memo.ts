'use client';

import { useMemo, type DependencyList } from 'react';

type Memoized<T> = T & { __memo?: boolean };

/**
 * A hook to memoize a value, but only if it's an object.
 * This is useful for preventing re-renders when passing objects as props.
 * 
 * @param factory A function that returns the value to be memoized.
 * @param deps An array of dependencies to watch for changes.
 * @returns The memoized value.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) {
    return memoized;
  }

  (memoized as Memoized<T>).__memo = true;
  return memoized;
}
