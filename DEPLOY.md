# Deployment

Desmake is deployed to **Cloudflare Containers**, which runs the existing custom
Next.js Node server (`dist/server.js`) **unchanged**. Containers keep the
process-memory session/order store (`globalThis`) shared across requests — which
is why we chose Containers over Pages/Workers (serverless would have re-introduced
the per-request state-loss problem).

## Artifacts

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Workers + Containers config (account, container class, migrations) |
| `worker.mjs` | Worker router — pins every request to one container instance, forwards to it |
| `Dockerfile` | Builds the Node 20 image: `pnpm install` → `next build` + `tsup` → runs `dist/server.js` on `:3000` |
| `.dockerignore` | Keeps the image build context clean |

## How to deploy

Requires: Docker daemon running locally, and `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
with Workers + Containers + DNS permissions.

```bash
pnpm install
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... wrangler deploy
```

`wrangler deploy` builds the Docker image, pushes it to Cloudflare's registry,
and deploys the Worker + container app (`desmake-desmakecontainer`).

## Routing / DNS

The Worker is invoked for the production domain via **Worker Routes** on the
`desmake.com` zone (`desmake.com/*` and `www.desmake.com/*` → script `desmake`),
plus orange-clouded CNAME records pointing at the Worker subdomain. Both
`https://desmake.com` and `https://www.desmake.com` serve the app.

> Note: a first-class Cloudflare *Custom Domain* (vs. Worker Route) needs the
> `Account > Workers: Custom Domains` permission on the API token. If your token
> lacks it (API returns `10405`), the Worker Route approach above is functionally
> equivalent.

## Known MVP limitations

- Storage is in-memory and resets when the container sleeps (10m idle) or restarts.
- Single pinned container instance; `max_instances = 3` allows scale-out.
