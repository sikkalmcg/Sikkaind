
import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';

/**
 * @fileOverview Root Layout Node (Server Component).
 * Uses dynamic import for RootLayoutClient to handle client-side chunk loading more robustly 
 * and mitigate ChunkLoadError timeouts in cloud environments.
 */
const RootLayoutClient = dynamic(() => import('./RootLayoutClient'), {
  ssr: true,
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script 
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-body antialiased bg-background">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
