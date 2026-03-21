import { useMemo, DependencyList } from 'react';

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList | undefined): T {
  const anom = useMemo(factory, deps);
  if (anom) {
    (anom as any).__memo = true;
  }
  return anom;
}
