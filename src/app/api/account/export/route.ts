import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { d1Query } from "@/lib/db";
import { getSessionAsync, getUserByIdAsync, SESSION_COOKIE } from "@/lib/session";
import { listOrdersForUserAsync } from "@/lib/stores";
import { rateLimit } from "@/lib/ratelimit";

// No edge runtime — reads the D1 store directly.

/**
 * R2-M-7 / GDPR Art.15 / CCPA: data-subject access request — export everything we
 * hold about the signed-in user as a single JSON download.
 *
 * Scoped strictly to the caller's own user_id (no cross-account read). Nothing
 * here is cached.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to export your data" } }, { status: 401 });
  }

  // Throttle: an export walks several tables; cap repeat calls per user.
  const rl = rateLimit(`${session.id}:export`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many export requests — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const user = await getUserByIdAsync(session.id);
  if (!user) {
    return NextResponse.json({ error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }

  const [orders, designs, creatorEarnings, referralEarnings, jobs, consents] = await Promise.all([
    listOrdersForUserAsync(user.id, 500),
    safeAll<{ slug: string; data: string }>(`SELECT slug, data FROM designs WHERE user_id = ?`, [user.id]),
    safeAll(`SELECT * FROM creator_earnings WHERE creator_id = ?`, [user.id]),
    safeAll(`SELECT * FROM referral_earnings WHERE referrer_id = ?`, [user.id]),
    safeAll<{ data: string }>(`SELECT data FROM generation_jobs WHERE user_id = ?`, [user.id]),
    safeAll(`SELECT consent, policy_version, created_at FROM consent_log WHERE user_id = ?`, [user.id]),
  ]);

  const payload = {
    export: {
      generated_at: new Date().toISOString(),
      format: "desmake-dsar-v1",
      note: "This file contains all personal data Desmake holds about your account. Order records required for tax/accounting are retained after account deletion and appear here too.",
    },
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      role: user.role,
      email_verified: user.emailVerified,
      bio: user.bio ?? null,
      city: user.city ?? null,
      role_tag: user.roleTag ?? null,
      verified: user.verified ?? false,
      referred_by: user.referredBy ?? null,
      created_at: user.createdAt,
      acquisition: {
        source: user.acquisitionSource ?? null,
        medium: user.acquisitionMedium ?? null,
        campaign: user.acquisitionCampaign ?? null,
        gclid: user.acquisitionGclid ?? null,
        fbclid: user.acquisitionFbclid ?? null,
        landing: user.acquisitionLanding ?? null,
      },
    },
    orders,
    designs: designs.map((d) => {
      try {
        return JSON.parse(d.data);
      } catch {
        return { slug: d.slug };
      }
    }),
    generation_jobs: jobs.map((j) => {
      try {
        return JSON.parse(j.data);
      } catch {
        return {};
      }
    }),
    creator_earnings: creatorEarnings,
    referral_earnings: referralEarnings,
    consent_records: consents,
  };

  const res = new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="desmake-data-export-${user.id}.json"`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
  return res;
}

/** Table-specific read that tolerates a missing/older schema without failing the export. */
async function safeAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await d1Query<T>(sql, params);
  } catch {
    return [];
  }
}
