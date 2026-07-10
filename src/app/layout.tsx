import type {} from 'next';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';

// @ts-ignore
import './globals.css';



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
        <link rel="stylesheet" href="https://js.arcgis.com/4.31/esri/themes/light/main.css" />
      </head>
      <body className="font-body antialiased bg-background">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}