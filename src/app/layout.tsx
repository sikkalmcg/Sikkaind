import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import RootLayoutClient from './RootLayoutClient';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * @fileOverview Root Layout Node (Server Component).
 * Delegates client-side context handling to RootLayoutClient to prevent useContext errors.
 */
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
