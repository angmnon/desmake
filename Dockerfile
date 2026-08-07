FROM node:20-slim

WORKDIR /app

# Install pnpm (the project's package manager)
RUN npm install -g pnpm@9

# Install deps first (cached layer). Non-frozen so a minor lockfile drift
# from the build host never fails the image build.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Cache-buster: force a clean rebuild from the current (consistent) source so the
# deployed image can't reuse a stale layer from the earlier debugging/rolling-deploy era.
ENV BUILD_REV="geo-seo-deploy-2026-08-07-3"

# Stripe publishable key (client-side). NEXT_PUBLIC_* must be present BEFORE `next build`
# so it is inlined into the client bundle — the card form renders in the browser.
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51SnhNoPZhV1yzVSmcQ9vGu3AjC6ivN0tEMPyUP6rUDVHPdd9DIwIR86YNk2Eks4nC2LQb4drvalyswqo9AD6DVS500HeUSJLZ7"

# Copy the rest of the source, then build (next build + tsup -> dist/server.js)
COPY . .
RUN pnpm next build
RUN pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV COZE_PROJECT_ENV=PROD

# SECRETS-IN-IMAGE FIX (#66): R2 / D1 / Stripe / Agnes credentials are NO LONGER
# baked into the image. They are Cloudflare Worker secrets (set via
# `wrangler secret put`) and forwarded into the container's process.env at launch via
# the `envVars` field in worker.mjs — so they never land in image layers or git history.
# The only value that must stay here is NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, because it is
# inlined into the client bundle at `next build` time (it is a public key anyway).

EXPOSE 3000

CMD ["node", "dist/server.js"]
