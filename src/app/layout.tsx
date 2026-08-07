import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CartProvider } from '@/lib/cart';
import { JsonLd, organizationSchema, websiteSchema } from '@/components/JsonLd';

export const metadata: Metadata = {
  metadataBase: new URL('https://desmake.com'),
  title: {
    default: 'Desmake — Design once. Manufacture anywhere.',
    template: '%s · Desmake',
  },
  description:
    'Desmake is the AI-native design-to-manufacture marketplace. Create with AI or upload your work, publish once, and let the network produce it on demand across six manufacturing adapters and ship worldwide. MCP/API-first, so AI agents can search, publish and order too.',
  keywords: [
    'AI design marketplace',
    'print on demand',
    'design to manufacture',
    'sell AI art',
    'AI generated products',
    'print on demand for AI artists',
    'MCP commerce',
    'agent commerce',
    'creator marketplace',
    'on demand manufacturing',
  ],
  authors: [{ name: 'Desmake' }],
  applicationName: 'Desmake',
  category: 'technology',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Desmake — Design once. Manufacture anywhere.',
    description:
      'AI-native design-to-manufacture marketplace. Publish one design; the network makes and ships it on demand. MCP/API-first for AI agents.',
    url: 'https://desmake.com',
    siteName: 'Desmake',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Desmake — Design once. Manufacture anywhere.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Desmake — Design once. Manufacture anywhere.',
    description:
      'AI-native design-to-manufacture marketplace. Publish once; produced on demand and shipped worldwide. MCP/API-first for AI agents.',
    images: ['/og.png'],
    creator: '@desmake',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
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
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
