import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveHandleToUserIdAsync } from "@/lib/session";
import { getSiteBaseUrl } from "@/lib/url";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// No edge runtime — resolveHandleToUserId reads the in-memory user store (R2/C1).

/**
 * Share-link attribution endpoint. A creator's "Share & earn" link points here:
 *
 *   /api/ref?ref=<handle>&to=<path>
 *
 * When `<handle>` resolves to a real registered user we plant a first-party
 * `dm_ref` cookie (30-day last-click window) and 302-redirect the visitor to
 * `to` (default "/"). On any subsequent order, /api/orders reads `dm_ref` and
 * attributes a 7% referral commission to that referrer. A visitor who later
 * signs up via ?ref= also gets a lifetime `referred_by` (handled in register).
 *
 * Invalid/missing handles still redirect (no cookie) so share links never 404.
 */
export async function GET(request: NextRequest) {
  // Light WAF-style throttle so share links can't be abused to hammer the endpoint.
  const rl = rateLimit(`${clientIp(request)}:ref`, 120);
  if (!rl.ok) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }
  const ref = request.nextUrl.searchParams.get("ref");
  const to = request.nextUrl.searchParams.get("to") || "/";
  // Only allow same-origin relative paths to avoid open-redirect to another host.
  const safeTo = to.startsWith("/") && !to.startsWith("//") ? to : "/";

  // Inside a Cloudflare Container `request.url` resolves to the internal host
  // (http://0.0.0.0:3000), so a redirect built from it sends real visitors to an
  // unreachable address. Always build the Location from the public base URL.
  const res = NextResponse.redirect(new URL(safeTo, getSiteBaseUrl(request)), 302);
  // C-1 fix: resolve through D1. The synchronous lookup only saw users registered in
  // this isolate, so most share links silently failed to plant the attribution cookie
  // and the referrer lost the commission they had earned.
  if (ref && (await resolveHandleToUserIdAsync(ref))) {
    res.cookies.set("dm_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV !== "development",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}
