// CMS API key auth. The key is a single shared ops key stored as the Cloudflare
// Worker secret CMS_API_KEY (set via `wrangler secret put`). Requests must send it via the
// `Authorization: Bearer <key>` header or the `x-cms-key` header.

import { createHash, timingSafeEqual } from "node:crypto";
import { rateLimit, clientIp } from "./ratelimit";

/**
 * Constant-time comparison of a provided key against the configured secret.
 *
 * R2-Low: the previous hand-rolled byte compare returned early on a length
 * mismatch (`provided.length !== expected.length`), which leaks the secret's
 * length to a timing observer and varies its runtime with the comparison
 * position. We hash both sides to a fixed-width SHA-256 digest and compare with
 * the platform `timingSafeEqual`, so neither the length nor the matching prefix
 * is observable.
 */
function safeKeyEqual(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function getCmsKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const key = req.headers.get("x-cms-key");
  if (key) return key.trim();
  return null;
}

export function cmsKeyValid(provided: string | null): boolean {
  const expected = process.env.CMS_API_KEY;
  if (!expected || !provided) return false;
  return safeKeyEqual(provided, expected);
}

export function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      error:
        "Unauthorized. Send the CMS API key via `Authorization: Bearer <key>` or the `x-cms-key` header.",
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="desmake-cms"',
      },
    },
  );
}

/**
 * R2-Low: throttle CMS API traffic per client IP. The CMS key is a powerful
 * shared secret and its handlers can write/delete content; without a limiter a
 * leaked key (or a runaway publisher script) could hammer the endpoint without
 * bound. 60 req/min/IP is far above any legitimate publishing cadence.
 *
 * Returns a 429 Response when the limit is exceeded, otherwise null.
 */
export function cmsThrottled(req: Request): Response | null {
  const rl = rateLimit(`cms:${clientIp(req)}`, 60);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded — slow down." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }
  return null;
}
