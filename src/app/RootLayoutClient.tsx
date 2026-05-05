'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';
import { FirebaseClientProvider } from '@/firebase';

/**
 * @fileOverview Client-side Root Layout Wrapper.
 * Manages global visibility for Header and Footer based on routing nodes.
 */
export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show header/footer on website pages including /track
  // Hide only on login and dashboard pages
  const isDashboardOrLogin = pathname?.startsWith('/login') || pathname?.startsWith('/dashboard');
  
  // Use 'mounted' to ensure client-specific UI (Header/Footer) only renders after hydration
  const showHeaderFooter = mounted && !isDashboardOrLogin;

  return (
    <FirebaseClientProvider>
      {showHeaderFooter && <Header />}
      <main className={showHeaderFooter ? 'block' : 'contents'}>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Loading Registry...</div>}>
          {children}
        </Suspense>
      </main>
      {showHeaderFooter && <Footer />}
      <Toaster />
    </FirebaseClientProvider>
  );
}
