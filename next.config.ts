import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site'],
  // The app renders artwork with inline SVG and native <img> (not next/image),
  // so the image optimizer is unused. Disabling it removes the open image proxy
  // that `remotePatterns: { hostname: '*' }` would otherwise expose (SSRF / bandwidth abuse).
  images: {
    unoptimized: true,
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.cn https://fonts.googleapis.com",
              // R2/H4: globals.css imports from fonts.googleapis.CN, whose @font-face
              // rules point at fonts.gstatic.CN. The policy only allowed gstatic.COM,
              // so every webfont on the site was blocked and the whole type system
              // silently fell back to system fonts.
              "font-src 'self' data: https://fonts.gstatic.cn https://fonts.gstatic.com",
              "script-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
