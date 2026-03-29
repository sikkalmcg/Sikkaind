import './globals.css';
import { ReactNode } from 'react';
import RootLayoutClient from './RootLayoutClient';

/**
 * @fileOverview Root Layout Node (Server Component).
 * Provides the core HTML structure and delegates client-side logic to the Client Wrapper.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
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
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
