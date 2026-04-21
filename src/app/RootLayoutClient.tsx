'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';
import { LoadingProvider } from '@/context/LoadingContext';
import GlobalLoader from '@/components/ui/global-loader';

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Is list mein wo paths rakhein jahan Header/Footer NAHI chahiye
  const hideLayoutPaths = [
    '/login',
    '/dashboard',
    '/modules',
    '/user-management'
  ];

  const isWebsitePage = !hideLayoutPaths.some(path => pathname?.startsWith(path));

  // Hydration error se bachne ke liye: 
  // Jab tak mounted na ho, basic structure dikhayein
  if (!mounted) {
    return (
      <FirebaseClientProvider>
        <LoadingProvider>
          <GlobalLoader />
          <main className="contents">{children}</main>
          <Toaster />
        </LoadingProvider>
      </FirebaseClientProvider>
    );
  }

  return (
    <FirebaseClientProvider>
      <LoadingProvider>
        <GlobalLoader />
        <Suspense fallback={null}>
          {isWebsitePage && <Header />}
          <main className={isWebsitePage ? 'block' : 'contents'}>
            {children}
          </main>
          {isWebsitePage && <Footer />}
        </Suspense>
        <Toaster />
      </LoadingProvider>
    </FirebaseClientProvider>
  );
}