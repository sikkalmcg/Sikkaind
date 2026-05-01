'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';

/**
 * @fileOverview Client-side Root Layout Wrapper.
 * Simplified to focus only on the homepage content and essential UI components.
 */
export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show header/footer on public website pages
  const isWebsitePage = !pathname || (
                        !pathname.startsWith('/login') && 
                        !pathname.startsWith('/dashboard'));

  return (
    <>
      <Suspense fallback={null}>
        {mounted && isWebsitePage && <Header />}
        <main className={mounted && isWebsitePage ? 'block' : 'contents'}>{children}</main>
        {mounted && isWebsitePage && <Footer />}
      </Suspense>
      <Toaster />
    </>
  );
}
