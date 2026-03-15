import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Hotel PMS — Gestion Hôtelière',
  description: 'Plateforme SaaS de gestion hôtelière multi-tenant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
