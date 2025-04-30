import type { Metadata } from "next";
import { Inter } from "next/font/google";
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stock Gainers - Real-time Market Analysis",
  description: "Track top gaining stocks with interactive charts and real-time market data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className={`${inter.className} h-full`}>
        <Providers>
          <div className="min-h-full">
            <Navigation />
            <main className="py-10">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
