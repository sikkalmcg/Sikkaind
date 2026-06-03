'use client';

import { createMongoAuth } from '@/mongodb/session-auth';
import { getMongoStore } from '@/lib/mongo-store';

export function initializeMongoServices() {
  return {
    auth: createMongoAuth(),
    mongoStore: getMongoStore(),
  };
}

export * from './provider';
export * from './client-provider';
export { useCollection } from './store/use-collection';
export { useCollectionOptimized } from './store/use-collection-optimized';
export * from './store/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
