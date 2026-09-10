// Lightweight in-memory fixed-window rate limiter.
//
// R2-M-11 (accepted limitation): Cloudflare Workers runs several isolates of this
// app, each with its own `globalThis`, so this limiter is PER-INSTANCE — the
// effective ceiling is roughly limit × live isolate count. It is a baseline
// abuse/brute-force blunter, not a hard global quota. Kept in-memory on purpose to
// avoid a D1/KV round-trip on every request.
//
// Upgrade path when a hard global ceiling is needed (e.g. for admin/settle or
// credential endpoints): swap the Map for a D1 counter table with an atomic
// `UPDATE ... WHERE count < limit` (the same fail-closed pattern used by
// consumeGenerationQuota in session.ts), or a Durable Object / KV with TTL. Do it
// behind this same `rateLimit()` signature so call sites don't change.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export type RateLimitResult = { ok: boolean; retryAfter: number; limit: number; remaining: number };

export function rateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  const remaining = Math.max(0, limit - b.count);
  const ok = b.count <= limit;
  const retryAfter = ok ? 0 : Math.ceil((b.resetAt - now) / 1000);
  if (buckets.size > 5000) {
    // Evict expired buckets to bound memory.
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return { ok, retryAfter, limit, remaining };
}

/** Best-effort client IP from Cloudflare/Proxy headers. */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
