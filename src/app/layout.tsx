import type { Metadata } from 'next';
import { Jost, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteMotion } from '@/components/SiteMotion';
import { CartProvider } from '@/lib/cart';
import { JsonLd, organizationSchema, websiteSchema } from '@/components/JsonLd';
import Analytics from '@/components/Analytics';
import CookieConsent from '@/components/CookieConsent';

// H-SEO/P0: render content & SEO pages via ISR instead of force-dynamic.
// force-dynamic sent `no-store` on every route and killed all edge caching —
// every request hit the origin container (worst-case TTFB, needless container
// load). With `revalidate`, Next emits `Cache-Control: s-maxage=600,
// stale-while-revalidate`, so Cloudflare's edge serves cached HTML for 10 min
// and revalidates in the background. Routes that truly need a per-request render
// keep their own `force-dynamic` (listing, explore, dashboard, cdn, robots,
// sitemap, llms). A deploy still reflects immediately: we purge the CDN cache
// right after `wrangler deploy`, so a stale page never survives a release.
export const revalidate = 600;

// Self-hosted webfonts (next/font/google). Downloaded at build time and served
// same-origin from /_next/static — no render-blocking external @import, no
// runtime dependency on fonts.googleapis.cn (slow/unreliable for an overseas
// audience). Each font exposes a CSS variable consumed by globals.css
// `--font-sans` / `--font-serif` (Silver & Ink Edition: Jost + Cormorant).
const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

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
  // NOTE: no top-level `alternates.canonical` here on purpose. Declaring it at the
  // root made every child page without its own canonical inherit "/", which told
  // Google the marketing/legal pages were duplicates of the homepage (de-indexing
  // them). Each page now declares its OWN canonical via `pageMetadata()` in
  // `src/lib/seo.ts`. The homepage simply self-canonizes by URL.
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
  // GSC / Bing Webmaster verification. Values are injected at runtime from the
  // Cloudflare Worker secrets / wrangler.jsonc `vars` (available at runtime via
  // `process.env`). Empty until configured — harmless, no tag emitted when unset.
  verification: buildVerification(),
};

function buildVerification(): Metadata["verification"] {
  const verification: Metadata["verification"] = {};
  if (process.env.GOOGLE_SITE_VERIFICATION) {
    verification.google = process.env.GOOGLE_SITE_VERIFICATION;
  }
  if (process.env.BING_SITE_VERIFICATION) {
    verification.other = { "msvalidate.01": process.env.BING_SITE_VERIFICATION };
  }
  return verification;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable}`}>
      <head>
        {/* P2-5: warm up connections to third-party origins the app loads after the
            user grants cookie consent (Stripe, GA, Meta). A preconnect is just a
            TLS/TCP handshake hint — no request is sent until the script itself
            loads — so it is safe to declare unconditionally and shaves a round trip
            off the post-consent load of js.stripe.com / analytics. */}
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://connect.facebook.net" />
      </head>
      <body className="antialiased">
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <CartProvider>
          <SiteMotion />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </CartProvider>
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
