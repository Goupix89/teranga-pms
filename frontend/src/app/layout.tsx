import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['500', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Teranga PMS — Gestion Hôtelière',
  description: 'Plateforme SaaS de gestion hôtelière multi-tenant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-wood-50 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
