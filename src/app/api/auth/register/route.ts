import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createUser, createSession, findUserByEmailAsync, resolveHandleToUserIdAsync, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { createVerificationToken } from "@/lib/verify";
import { sendVerificationEmail } from "@/lib/email";
import { getSiteBaseUrl } from "@/lib/url";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { readAttributionFromRequest } from "@/lib/tracking";
import { redact } from "@/lib/monitor";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  // WAF-style throttle on account creation (brute-force / enumeration defense).
  const rl = rateLimit(`${clientIp(request)}:register`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many sign-up attempts — please try again later." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const payload = (body ?? {}) as { email?: unknown; password?: unknown; name?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: { code: "validation", message: "A valid email is required" } }, { status: 400 });
  }
  if (!password || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: { code: "validation", message: "Password must be 6–128 characters" } }, { status: 400 });
  }
  // M-6 / R2: avoid account enumeration — do NOT confirm whether the email exists in
  // the error text (the previous wording said "…with this email", which is a loud oracle).
  // The status code stays 409 for the client to branch on, but the message is generic.
  // C-1/H-8 fix: the duplicate check must hit D1 too. Checking only the in-memory
  // map let a second registration with an existing email slip through, and the
  // upsert then rewrote the row's `id`, orphaning that account's past orders.
  if (await findUserByEmailAsync(email)) {
    return NextResponse.json(
      { error: { code: "conflict", message: "Registration could not be completed. If you already have an account, sign in instead." } },
      { status: 409 },
    );
  }

  // M-UGC: attribution at sign-up. A `?ref=<handle>` query param (from a share
  // link) records a lifetime `referred_by` relationship — the referrer earns a
  // commission on this user's future purchases even if the dm_ref cookie expires.
  const refParam = request.nextUrl.searchParams.get("ref");
  const referredBy = refParam ? await resolveHandleToUserIdAsync(refParam) : undefined;

  // P0-2: capture paid-acquisition attribution (UTM / gclid / fbclid) from the
  // first-party dm_attrib cookie and persist it on the user for campaign ROI.
  const attrib = readAttributionFromRequest(request);
  const acquisition = attrib.utm_source
    ? {
        source: attrib.utm_source,
        medium: attrib.utm_medium,
        campaign: attrib.utm_campaign,
        gclid: attrib.gclid,
        fbclid: attrib.fbclid,
        landing: attrib.landing_path,
      }
    : null;

  try {
    const user = await createUser(email, name, password, { referredBy: referredBy ?? null, acquisition });
    const sessionUser = { id: user.id, email: user.email, name: user.name, handle: user.handle, role: user.role, emailVerified: user.emailVerified, sessionEpoch: user.sessionEpoch ?? 0 };
    const token = createSession(sessionUser);

    // Email confirmation: create a verification token and send it. When no email
    // provider is configured we surface the link in the response so the flow is
    // still testable (dev only — never log tokens in production).
    let verificationLink: string | undefined;
    let verificationSent = false;
    try {
      const vtoken = await createVerificationToken(user.id);
      const baseUrl = getSiteBaseUrl(request);
      const sent = await sendVerificationEmail(baseUrl, user.email, vtoken);
      verificationSent = Boolean(sent.delivered);
      // M-12 / R2: never surface the raw verification link outside an explicit
      // `development` build (previously "not production" — any staging/unset runtime
      // would leak valid tokens). Fail-safe default: hidden.
      if (!sent.delivered && process.env.NODE_ENV === "development") verificationLink = sent.link;
      if (!sent.delivered && process.env.NODE_ENV !== "development") {
        // C-3: fail loud. A silent failure here is invisible to the buyer but blocks
        // every order behind the email-verification gate. Log the user id, never the
        // email address (PII in logs).
        console.error("[register] CRITICAL: verification email NOT delivered for user", user.id);
      }
    } catch (e) {
      console.error("[register] verification email failed:", redact(e instanceof Error ? e.message : String(e)));
    }

    const res = NextResponse.json(
      {
        user: sessionUser,
        email_verification_link: verificationLink,
        // M-3: let the UI tell the buyer to check their inbox instead of silently
        // letting them walk into a 403 at the final checkout step.
        verification_required: !user.emailVerified,
        verification_sent: verificationSent,
      },
      { status: 201 },
    );
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    // R2: never echo the internal error text to the client (it could contain a duplicate-
    // email oracle or an internal message). Log server-side, return a generic conflict.
    console.error("[register] failed:", redact(err instanceof Error ? err.message : String(err)));
    return NextResponse.json(
      { error: { code: "conflict", message: "Registration could not be completed. If you already have an account, sign in instead." } },
      { status: 409 },
    );
  }
}
