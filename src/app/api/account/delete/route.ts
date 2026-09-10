import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { d1Run, d1Query, D1_ENABLED } from "@/lib/db";
import {
  getSessionAsync,
  getUserByIdAsync,
  verifyPassword,
  bumpSessionEpoch,
  destroySession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { deleteFromR2 } from "@/lib/r2";
import { notifyAlert, recordError } from "@/lib/monitor";
import { randomBytes } from "node:crypto";

// No edge runtime — writes D1 + R2.

/**
 * R2-M-7 / GDPR Art.17 / CCPA: account deletion (right to erasure).
 *
 * Deletes the profile and published listings and scrubs direct identifiers from
 * the user row. Order records are RETAINED (financial/tax obligation, GDPR
 * Art.17(3)(b)) — this matches the statement in /privacy. Requires the account
 * password as a re-authentication step, plus an explicit confirm token, so a
 * hijacked/CSRF'd session cannot silently destroy an account.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to delete your account" } }, { status: 401 });
  }

  const rl = rateLimit(`${session.id}:delete`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: { code: "validation", message: 'Send {"confirm":"DELETE"} to confirm account deletion' } },
      { status: 400 },
    );
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json(
      { error: { code: "validation", message: "Your password is required to delete your account" } },
      { status: 400 },
    );
  }

  const user = await getUserByIdAsync(session.id);
  if (!user) {
    return NextResponse.json({ error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Incorrect password" } },
      { status: 401 },
    );
  }

  const nowIso = new Date().toISOString();

  // 1) Remove published listings (and their R2 images where the URL maps to a key).
  const designs = await safeAll<{ slug: string; data: string }>(
    `SELECT slug, data FROM designs WHERE user_id = ?`,
    [user.id],
  );
  const r2Keys: string[] = [];
  for (const d of designs) {
    try {
      const parsed = JSON.parse(d.data) as { imageUrl?: string };
      const key = r2KeyFromUrl(parsed.imageUrl);
      if (key) r2Keys.push(key);
    } catch {
      /* ignore malformed row */
    }
  }

  // Scrub direct identifiers from the retained user row. `handle` is UNIQUE, so
  // replace it with a per-id tombstone; the password is replaced with an
  // unguessable random value so the account can never be logged into again.
  const tombstoneEmail = `deleted+${user.id}@deleted.invalid`;
  const tombstoneHandle = `deleted-${user.id.slice(-10)}`;
  const scramble = `scrypt$16384$${randomBytes(16).toString("hex")}$${randomBytes(64).toString("hex")}`;

  if (D1_ENABLED) {
    // R2: erasure writes must be loud. A silent failure would tell the user their
    // data is gone while rows remain. If any critical write fails we abort with a
    // 500 and an ops alert instead of reporting a false success.
    const errors: string[] = [];
    const critical: Array<[string, string, unknown[]]> = [
      ["designs", `DELETE FROM designs WHERE user_id = ?`, [user.id]],
      ["generation_jobs", `DELETE FROM generation_jobs WHERE user_id = ?`, [user.id]],
      ["sessions", `DELETE FROM sessions WHERE user_id = ?`, [user.id]],
      ["email_verifications", `DELETE FROM email_verifications WHERE user_id = ?`, [user.id]],
      ["users.scrub", `UPDATE users SET
         email = ?, name = ?, password_hash = ?, handle = ?,
         bio = NULL, city = NULL, role_tag = NULL, avatar_seed = NULL,
         referred_by = NULL, acquisition_source = NULL, acquisition_medium = NULL,
         acquisition_campaign = NULL, acquisition_gclid = NULL, acquisition_fbclid = NULL,
         acquisition_landing = NULL, session_epoch = session_epoch + 1
       WHERE id = ?`, [tombstoneEmail, "Deleted user", scramble, tombstoneHandle, user.id]],
    ];
    for (const [label, sql, params] of critical) {
      try {
        await d1Run(sql, params);
      } catch (e) {
        errors.push(label);
        recordError(`account/delete.${label}`, e);
      }
    }
    // Audit trail for the deletion itself (non-critical).
    try {
      await d1Run(
        `INSERT INTO consent_log (id, user_id, anon_id, consent, policy_version, created_at)
         VALUES (?, ?, NULL, 'account_deleted', '2026-09', ?)`,
        [`cns_del_${user.id.slice(-12)}_${Date.now().toString(36)}`, user.id, nowIso],
      );
    } catch (e) {
      recordError("account/delete.audit", e);
    }
    if (errors.length) {
      void notifyAlert(
        "desmake: account deletion FAILED",
        `Erasure for user ${user.id} failed on: ${errors.join(", ")}. Manual follow-up required.`,
      ).catch(() => {});
      return NextResponse.json(
        {
          error: {
            code: "partial_failure",
            message: "We could not complete the deletion. Your session is still active — please contact support.",
          },
        },
        { status: 500 },
      );
    }
  }

  // 2) Best-effort R2 image cleanup (never fails the deletion).
  for (const key of r2Keys) {
    try {
      await deleteFromR2(key);
    } catch (e) {
      recordError("account/delete.r2", e);
    }
  }

  // 3) Invalidate every outstanding session and clear the cookie.
  try {
    await bumpSessionEpoch(user.id);
  } catch (e) {
    recordError("account/delete.bumpEpoch", e);
  }
  destroySession(request.cookies.get(SESSION_COOKIE)?.value);

  void notifyAlert(
    "desmake: account deleted",
    `User ${user.id} deleted their account at ${nowIso}. ${designs.length} listing(s) removed.`,
  ).catch(() => {});

  const res = NextResponse.json(
    {
      ok: true,
      deleted: { listings: designs.length, images: r2Keys.length },
      retained: { orders: "Financial records retained for tax/accounting (GDPR Art.17(3)(b))." },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}

function r2KeyFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Uploaded/AI images are served via /cdn/<key>; derive the R2 key from that path.
  const m = url.match(/\/cdn\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function safeAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await d1Query<T>(sql, params);
  } catch {
    return [];
  }
}
