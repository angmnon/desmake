import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { d1Run, D1_ENABLED } from "@/lib/db";
import { newId } from "@/lib/stores";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// No edge runtime — this handler writes the consent_log table in D1.

const POLICY_VERSION = "2026-09";
const ANON_COOKIE = "dm_anon";

/**
 * R2-M-6: server-side cookie-consent record (GDPR Art.7 "demonstrate consent").
 *
 * The visitor's decision is stored in a first-party cookie client-side; this
 * endpoint mirrors it into the D1 `consent_log` table with a timestamp and the
 * policy version in force, so a decision can be proven later. Anonymous visitors
 * get a random `dm_anon` id (first-party, functional) to key the record; signed
 * in users also carry their user_id.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`${clientIp(request)}:consent`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const consent = body.consent === "granted" || body.consent === "denied" ? body.consent : null;
  if (!consent) {
    return NextResponse.json(
      { error: { code: "validation", message: "consent must be 'granted' or 'denied'" } },
      { status: 400 },
    );
  }
  const policyVersion =
    typeof body.policyVersion === "string" && body.policyVersion.length <= 40
      ? body.policyVersion
      : POLICY_VERSION;

  // Identify the subject: signed-in user when available, otherwise a random
  // first-party anon id so we can group a visitor's decisions without PII.
  const session = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  let anonId = request.cookies.get(ANON_COOKIE)?.value || null;
  let issuedAnon = false;
  if (!anonId) {
    anonId = newId("anon");
    issuedAnon = true;
  }

  if (D1_ENABLED) {
    try {
      await d1Run(
        `INSERT INTO consent_log (id, user_id, anon_id, consent, policy_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId("cns"), session?.id ?? null, anonId, consent, policyVersion, new Date().toISOString()],
      );
    } catch {
      // Consent recording must never break the page; the client cookie already
      // holds the decision and a later decision will retry the write.
    }
  }

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (issuedAnon) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV !== "development",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
