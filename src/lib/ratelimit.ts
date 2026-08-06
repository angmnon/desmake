// Lightweight in-memory fixed-window rate limiter.
//
// NOTE: Cloudflare Containers run up to max_instances copies, so this limiter is
// per-instance, not global — the effective ceiling is roughly limit × instance
// count. It is a baseline WAF-style throttle that blunts abuse and brute force;
// for a hard global ceiling, back this with D1/KV. Kept in-memory to avoid a
// network round-trip on every request.

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
