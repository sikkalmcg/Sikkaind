'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';
import { MongoClientProvider } from '@/mongodb';
import TapThemeToggle from '@/components/Theme/TapThemeToggle';

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

  // Yahan par humne /dashboard ko bhi shamil kar diya hai
  const isExcludedPage = pathname?.startsWith('/login') || 
                         pathname?.startsWith('/print') || 
                         pathname?.startsWith('/dashboard');

  // Dashboard, login aur print pages par header/footer nahi dikhega
  const showHeaderFooter = mounted && !isExcludedPage;

  return (
    <MongoClientProvider>
      {showHeaderFooter && <Header />}
      
      {/* Theme toggle bhi dashboard, login ya print par nahi dikhega */}
      {!isExcludedPage && (
        <div className="fixed top-16 right-3 z-[9999] print:hidden">
          <TapThemeToggle />
        </div>
      )}
      
      <main className={showHeaderFooter ? 'block' : 'contents'}>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Loading...</div>}>
          {children}
        </Suspense>
      </main>
      
      {showHeaderFooter && <Footer />}
      <Toaster />
    </MongoClientProvider>
  );
}