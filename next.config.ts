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
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.cn https://fonts.googleapis.com https://js.stripe.com",
              // R2/H4: globals.css imports from fonts.googleapis.CN, whose @font-face
              // rules point at fonts.gstatic.CN. The policy only allowed gstatic.COM,
              // so every webfont on the site was blocked and the whole type system
              // silently fell back to system fonts.
              "font-src 'self' data: https://fonts.gstatic.cn https://fonts.gstatic.com",
              // Stripe.js is loaded from js.stripe.com; without it the Elements card
              // field never mounts and NOBODY can pay.
              // NOTE: 'unsafe-inline' is required by Next.js App Router, which injects
              // inline bootstrap scripts. The H-1 stored-XSS is fixed at source by
              // escaping JSON-LD (src/components/JsonLd.tsx) rather than relying on CSP.
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
