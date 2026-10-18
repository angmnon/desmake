// One-time backfill Worker for the P1 Images FREE-PLAN migration.
//
// After deploying the app change, existing R2 images have NO pre-generated
// variant keys (<key>/v<width>). This worker lists originals under the same
// allowed prefixes and generates the variants the loader now expects, so legacy
// images render via static variants (zero per-view transform cost) instead of
// falling back to full-res.
//
// Deploy (temporary):
//   wrangler deploy scripts/backfill-image-variants.mjs --config scripts/backfill.wrangler.toml
// Trigger (repeat with ?cursor until done):
//   curl -H "x-backfill-secret: $BACKFILL_SECRET" https://backfill-desmake.<sub>.workers.dev/
// Then DELETE the worker + its secret when finished.
//
// Safety: skips any key ending in /v<digits> (already a variant) and any object
// whose <key>/v256 variant already exists (idempotent — safe to re-run).

const SIZES = [256, 640, 1080, 1920];
const PREFIXES = ["uploads/", "ai/", "public/", "cms/"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.headers.get("x-backfill-secret") !== env.BACKFILL_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    let cursor = url.searchParams.get("cursor") || undefined;
    let processed = 0;
    let variantsMade = 0;
    let skipped = 0;
    let errors = 0;
    const maxObjects = 200; // per invocation — stay well under CPU limit

    for (const prefix of PREFIXES) {
      // stop early if we've done enough this invocation
      while (processed + skipped < maxObjects && (!cursor || true)) {
        const listed = await env.BUCKET.list({ prefix, cursor, limit: 100 });
        for (const obj of listed.objects) {
          const key = obj.key;
          // already a variant, or a non-image prefix we don't care about
          if (/\/v\d+$/.test(key)) { skipped++; continue; }
          // idempotency: if the 256 variant already exists, assume all do
          const probe = await env.BUCKET.head(`${key}/v256`).catch(() => null);
          if (probe) { skipped++; continue; }

          try {
            const original = await env.BUCKET.get(key);
            if (!original) { skipped++; continue; }
            const bytes = new Uint8Array(await original.arrayBuffer());
            for (const size of SIZES) {
              const chain = env.IMAGES.input(bytes);
              chain.transform({ width: size, fit: "cover" });
              const result = await chain.output({ format: "image/jpeg", quality: 80 });
              const resp = await result.response();
              const vb = new Uint8Array(await resp.arrayBuffer());
              await env.BUCKET.put(`${key}/v${size}`, vb, { contentType: "image/jpeg" });
              variantsMade++;
            }
            processed++;
          } catch (e) {
            errors++;
            console.error("backfill failed for", key, e?.message || e);
          }
        }
        cursor = listed.cursor || undefined;
        if (!cursor) break; // no more objects in this prefix
      }
      if (processed + skipped >= maxObjects) break;
    }

    return new Response(JSON.stringify({
      processed, variantsMade, skipped, errors,
      cursor: cursor || null,
      done: !cursor,
    }), { headers: { "content-type": "application/json" } });
  },
};
