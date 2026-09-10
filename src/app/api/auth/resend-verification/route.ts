import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionAsync, getUserByIdAsync, SESSION_COOKIE } from "@/lib/session";
import { createVerificationToken } from "@/lib/verify";
import { sendVerificationEmail } from "@/lib/email";
import { getSiteBaseUrl } from "@/lib/url";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * H-10: resend the email-verification link.
 *
 * The verification email is the single gate between a new account and placing an
 * order, but there was no way to get another one — if the first message was lost
 * (or, as in C-3, never actually sent) the buyer was stuck with no self-serve
 * recovery at all.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to resend the verification email" } },
      { status: 401 },
    );
  }

  // Throttle per account (and per IP) so this cannot be used to mail-bomb anyone.
  const rl = rateLimit(`${user.id}:resend-verify`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests — please wait a few minutes." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const ipRl = rateLimit(`${clientIp(request)}:resend-verify`, 10);
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests — please wait a few minutes." } },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } },
    );
  }

  const rec = await getUserByIdAsync(user.id);
  if (rec?.emailVerified) {
    return NextResponse.json({ ok: true, already_verified: true });
  }

  try {
    const token = await createVerificationToken(user.id);
    const baseUrl = getSiteBaseUrl(request);
    const sent = await sendVerificationEmail(baseUrl, user.email, token);
    return NextResponse.json({
      ok: true,
      delivered: sent.delivered,
      // M-12 / R2: never hand the raw token back outside an explicit `development` build.
      link: process.env.NODE_ENV === "development" ? sent.link : undefined,
    });
  } catch (e) {
    console.error("[resend-verification] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: { code: "send_failed", message: "Could not send the verification email. Please try again shortly." } },
      { status: 502 },
    );
  }
}
