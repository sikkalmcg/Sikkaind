'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';
import { LoadingProvider } from '@/context/LoadingContext';
import GlobalLoader from '@/components/ui/global-loader';

/**
 * @fileOverview Client-side Root Layout Wrapper.
 * Manages providers and conditional website navigation logic.
 */
export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Registry Logic: Safely handle null pathname during SSR
  const isWebsitePage = !pathname || (
                        !pathname.startsWith('/login') && 
                        !pathname.startsWith('/dashboard') && 
                        !pathname.startsWith('/modules') && 
                        !pathname.startsWith('/user-management'));

  return (
    <FirebaseClientProvider>
      <LoadingProvider>
        <GlobalLoader />
        <Suspense fallback={null}>
          {mounted && isWebsitePage && <Header />}
          <main className={mounted && isWebsitePage ? 'block' : 'contents'}>{children}</main>
          {mounted && isWebsitePage && <Footer />}
        </Suspense>
        <Toaster />
      </LoadingProvider>
    </FirebaseClientProvider>
  );
}
