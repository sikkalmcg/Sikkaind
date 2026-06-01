'use client';

import { MongoAuth } from '@/mongodb/session-auth';

export function initiateAnonymousSignIn(authInstance: MongoAuth): void {
  void authInstance.signInAnonymously();
}
