import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CartProvider } from '@/lib/cart';

export const metadata: Metadata = {
  title: {
    default: 'Desmake — Design once. Manufacture anywhere.',
    template: '%s · Desmake',
  },
  description:
    'The AI native design marketplace. Create with AI, publish once, and let the network manufacture and ship worldwide.',
  keywords: ['AI design', 'design marketplace', 'print on demand', 'manufacturing', 'creators', 'AI generated art'],
  authors: [{ name: 'Desmake' }],
  openGraph: {
    title: 'Desmake — Design once. Manufacture anywhere.',
    description: 'The AI native design marketplace.',
    siteName: 'Desmake',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
