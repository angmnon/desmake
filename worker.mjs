import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

// The container runs `node dist/server.js` (the custom Next.js server) and
// listens on PORT (3000).
export class DesmakeContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";

  // SECRETS-IN-IMAGE FIX (#66): credentials are NO LONGER baked into the Dockerfile
  // ENV. Instead they live as Cloudflare Worker secrets (set via `wrangler secret put`)
  // and are forwarded into the container's process.env at launch via `envVars`. This
  // keeps tokens out of the image layers and out of git history. The only value that
  // must remain in the Dockerfile is NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, because it is
  // inlined into the client bundle at `next build` time (and it is a public key).
  envVars = {
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_BUCKET: env.R2_BUCKET,
    R2_S3_ACCESS_KEY_ID: env.R2_S3_ACCESS_KEY_ID,
    R2_S3_SECRET_ACCESS_KEY: env.R2_S3_SECRET_ACCESS_KEY,
    D1_DATABASE_ID: env.D1_DATABASE_ID,
    D1_CF_API_TOKEN: env.D1_CF_API_TOKEN,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    AGNES_BASE_URL: env.AGNES_BASE_URL,
    AGNES_IMAGE_MODEL: env.AGNES_IMAGE_MODEL,
    AGNES_API_KEY: env.AGNES_API_KEY,
    SITE_URL: env.SITE_URL,
    // M6: 月结打款端点 /api/admin/settle 的 bearer token。未设置时该端点 fail-closed（全部 401）。
    ADMIN_TOKEN: env.ADMIN_TOKEN,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve uploaded design images straight from R2, same-origin, so the
    // marketplace never depends on an external/public bucket URL.
    if (url.pathname.startsWith("/cdn/")) {
      const key = url.pathname.slice("/cdn/".length);
      const obj = await env.DESMAKE_BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": obj.httpMetadata?.contentType || "image/jpeg",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    const container = getContainer(env.DESMAKE, "desmake");
    return container.fetch(request);
  },
};
