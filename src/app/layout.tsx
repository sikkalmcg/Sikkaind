import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

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
      <body className="font-body antialiased bg-background">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
