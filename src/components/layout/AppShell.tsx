'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isWebsitePage = !pathname || (
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/modules')
  );

  return (
    <>
      {isWebsitePage && <Header />}
      <main className={isWebsitePage ? 'block' : 'contents'}>{children}</main>
      {isWebsitePage && <Footer />}
    </>
  );
}
