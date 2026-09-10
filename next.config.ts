import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site'],
  // Product images are served same-origin from /cdn/* (Cloudflare R2 via the Worker),
  // so the next/image optimizer can encode them to AVIF/WebP and emit responsive
  // srcsets with no remotePatterns and no open proxy (it only ever optimizes URLs
  // we pass, which are our own /cdn paths).
  // B1 migration: the in-container sharp/next-image optimizer is gone (no Containers).
  // Cloudflare Image Resizing transforms images at the edge via the custom loader in
  // ./image-loader.ts (serves /cdn-cgi/image/<opts>/<src> from R2). Enable
  // "Transformations" on the desmake.com zone and allow the R2 bucket as a source.
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  // H7 / P2: baseline security response headers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // H-1/M-13: HSTS + tighten the cross-origin surface. Only enable 'preload'
          // once you are certain every subdomain is HTTPS-only.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Stripe card brand icons + the Elements iframe assets live under
              // *.stripe.com; allow them so card art renders. Analytics beacons
              // (GA4 / Meta pixel) load 1x1 gifs from these hosts.
              "img-src 'self' data: https: https://*.stripe.com https://www.google-analytics.com https://www.googletagmanager.com https://*.facebook.com",
              "style-src 'self' 'unsafe-inline' https://js.stripe.com",
              // Webfonts are self-hosted at build time by next/font (served from
              // /_next/static/media → 'self'), so no third-party font host is needed.
              // The previous policy allowed fonts.googleapis.cn / fonts.gstatic.cn from
              // the era when globals.css used a remote @import — now stale and removed.
              "font-src 'self' data:",
              // Stripe.js is loaded from js.stripe.com; without it the Elements card
              // field never mounts and NOBODY can pay.
              //
              // R2-M-5 (accepted risk): 'unsafe-inline' is still present. A nonce or
              // 'strict-dynamic' would require reading headers() during render, which
              // forces every route to dynamic rendering — undoing the ISR/static
              // caching this site depends on for both cost and Core Web Vitals. The
              // inline-script XSS class is instead closed at the source: all
              // dangerouslySetInnerHTML sinks escape their input (JsonLd.tsx escapes
              // `<`, Artwork.tsx restricts palettes to a HEX whitelist). Revisit if a
              // nonce can be threaded through without losing static rendering.
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com",
              // Stripe.js talks to api.stripe.com (confirmCardPayment) and telemetry.
              // M-13: GA4 / Meta / Cloudflare Insights were previously blocked here, so
              // every client-side analytics beacon failed with a CSP console error.
              "connect-src 'self' https://api.stripe.com https://*.stripe.com https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://*.facebook.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
              // The Stripe Elements card field is rendered inside an iframe served
              // from js.stripe.com; frame-src must permit it or the field is blank.
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              // H-1 hardening: close the remaining injection-adjacent surfaces.
              "object-src 'none'",
              "base-uri 'none'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// B1 migration: wire Cloudflare bindings into `next dev` so server code can use
// getCloudflareContext() against local .dev.vars bindings during development.
initOpenNextCloudflareForDev();
