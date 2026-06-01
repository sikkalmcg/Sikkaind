'use client';

import React, { useMemo, type ReactNode } from 'react';
import { MongoProvider } from '@/mongodb/provider';
import { initializeMongoServices } from '@/mongodb';

interface MongoClientProviderProps {
  children: ReactNode;
}

export function MongoClientProvider({ children }: MongoClientProviderProps) {
  const mongoServices = useMemo(() => initializeMongoServices(), []);

  return (
    <MongoProvider auth={mongoServices.auth} mongoStore={mongoServices.mongoStore}>
      {children}
    </MongoProvider>
  );
}
