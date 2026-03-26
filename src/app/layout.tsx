import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider } from "@/firebase/provider";
import { LoadingProvider } from "@/context/LoadingContext"; // Import the LoadingProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sikka (Internal)",
  description: "Sikka internal logistics software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <FirebaseProvider>
          <LoadingProvider> {/* Add the LoadingProvider here */}
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </LoadingProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
