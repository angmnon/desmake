# Deployment

> **This file was rewritten (R2-M-13).** The previous version described a
> Cloudflare **Containers** deployment (`wrangler.toml`, `worker.mjs`,
> `Dockerfile`, a custom `dist/server.js`) that no longer exists. Following it
> would have produced a broken deploy and left every Worker secret unset.

Desmake runs on **Cloudflare Workers** via the OpenNext adapter
(`@opennextjs/cloudflare`). There is no container and no custom Node server.
The Worker entry is `.open-next/worker.js`; storage is D1 + R2 (both native
Worker bindings); the app is a Next.js 16 App Router project.

## The one accurate runbook

**`B1_DEPLOY_RUNBOOK.html`** (repo root) is the authoritative, step-by-step
deploy guide — bindings, secrets, the build, cache purge and the post-deploy
smoke test. Read it before deploying. The summary below is a convenience copy;
if the two ever disagree, the runbook wins.

## Artifacts

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Workers config: `main` = `.open-next/worker.js`, D1/R2/Images bindings, `nodejs_compat`, vars |
| `open-next.config.ts` | OpenNext adapter config |
| `next.config.ts` | Next.js config + image loader + security headers |
| `package.json` `deploy` | `node scripts/gen-blog-content.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy` |
| `scripts/deploy.sh` | Deploy entry point used by the Coze platform (validates token env, then `pnpm deploy`) |

## Dependencies must be built on Linux

`node_modules` must be produced **inside the build environment** (a Linux
container), because a Windows-hosted `node_modules` contains symlinks the adapter
cannot traverse. Build and deploy together:

```bash
docker run --rm -v "$PWD":/app -w /app node:22-bookworm bash -c \
  "corepack enable && pnpm install && pnpm run deploy"
```

`pnpm deploy` = inline blog markdown → `next build` → OpenNext transform →
`wrangler deploy`. Set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the
environment.

## Required secrets

Set once per Worker with `wrangler secret put <NAME>` (never commit them):

| Secret | Purpose |
|--------|---------|
| `SESSION_SECRET` | HMAC key for stateless session cookies (**fail-closed** in production) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments + webhook signature verification |
| `CMS_API_KEY` | Shared ops key for the `/api/cms` publishing API |
| `RESEND_API_KEY` | Transactional email (verification, receipts) |
| `AGNES_API_KEY` | AI image generation provider |
| `ALERT_WEBHOOK_URL` | Ops alert webhook (optional) |

## Routing / DNS

The Worker serves `desmake.com` and `www.desmake.com` through Worker Routes on
the zone, plus orange-clouded DNS. Custom Domains require the
`Workers: Custom Domains` token permission; Worker Routes are equivalent when
that permission is unavailable.

## After every deploy

1. **Purge the zone cache** (`purge_everything`) — this is mandatory, not optional.
   Static pages default to `s-maxage`, and (critically) `/_next/static/chunks/*.js`
   filenames are **NOT content-hashed** — they stay the same across builds while
   being served `Cache-Control: public, max-age=31536000, immutable`. So a chunk
   whose name is unchanged but whose content did change will keep serving the OLD
   body from the edge until purged. Symptom: the deploy "succeeded" but the live
   JS still contains the previous build's code. Verify with
   `curl -sI https://desmake.com/_next/static/chunks/<name>.js` and look for
   `CF-Cache-Status: HIT` plus a body that matches the new build.
2. **Bump `BUILD_REV`** for any HTML/JS/metadata change so clients fetch fresh assets.
3. **Smoke-test** the key routes (see the runbook's checklist) and confirm the
   response headers carry the expected `Cache-Control`.

## Public bindings summary

- **D1** `DB` → `desmake-db` (users, orders, designs, earnings, cms, audit tables)
- **R2** `BUCKET` → `desmake-assets` (uploads / AI images / CMS images), served at `/cdn/<key>`
- **Images** `IMAGES` → Cloudflare Image Resizing (`/cdn-cgi/image/...`)
