'use client';
/**
 * @fileOverview Global Loading Context for Sikka LMC.
 * Manages the "Please wait..." ERP-grade interaction shield with a safety fuse.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showLoader = useCallback(() => setIsLoading(true), []);
  const hideLoader = useCallback(() => setIsLoading(false), []);

  /**
   * Snappy Response Protocol:
   * Automatically hide the loader after 4 seconds to prevent interaction deadlocks.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isLoading) {
      timer = setTimeout(() => {
        setIsLoading(false);
      }, 4000); 
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  const value = useMemo(() => ({
    isLoading,
    showLoader,
    hideLoader
  }), [isLoading, showLoader, hideLoader]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
