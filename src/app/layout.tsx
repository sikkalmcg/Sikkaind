'use client';
import '../globals.css';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/website/Header';
import Footer from '@/components/website/Footer';
import { LoadingProvider } from '@/context/LoadingContext';
import GlobalLoader from '@/components/ui/global-loader';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
                        !pathname.startsWith('/sikka-accounts') && 
                        !pathname.startsWith('/user-management'));

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-background">
        <FirebaseClientProvider>
          <LoadingProvider>
            <GlobalLoader />
            {mounted && isWebsitePage && <Header />}
            <main className={mounted && isWebsitePage ? 'block' : 'contents'}>{children}</main>
            {mounted && isWebsitePage && <Footer />}
            <Toaster />
          </LoadingProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
