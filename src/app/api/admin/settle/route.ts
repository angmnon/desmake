import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { d1Query, d1Run, D1_ENABLED } from "@/lib/db";
import { earningsStore, referralEarningsStore, newId } from "@/lib/stores";
import { rateLimit } from "@/lib/ratelimit";

// 月结手动打款端点：运营用 ADMIN_TOKEN 触发，把 creator_earnings + referral_earnings
// 的 pending → paid。不对外暴露，仅运营后台使用。

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// M-14: constant-time comparison so the token check doesn't leak length/character
// timing. `!ADMIN_TOKEN` keeps the endpoint fail-closed when the secret is unset.
function safeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // M-1: this is a money-moving admin endpoint with no rate limit historically — throttle it.
  const rl = rateLimit(`admin-settle`, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!ADMIN_TOKEN || !safeTokenEqual(token, ADMIN_TOKEN)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Admin token required" } }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const creatorId = typeof body.creator_id === "string" ? body.creator_id : null;

  const now = new Date().toISOString();
  let settledCreators = 0;
  let settledReferrals = 0;

  // R2 fix: write D1 FIRST (source of truth) and mirror to memory only afterwards. The
  // previous order (memory → D1) left the two diverged forever if the D1 UPDATE threw.
  // The D1 UPDATEs are idempotent (`WHERE status='pending'`), so a re-run can't double-pay.
  if (D1_ENABLED) {
    try {
      const creatorSql = creatorId
        ? `UPDATE creator_earnings SET status='paid', paid_at=? WHERE status='pending' AND creator_id=?`
        : `UPDATE creator_earnings SET status='paid', paid_at=? WHERE status='pending'`;
      settledCreators = await d1Run(creatorSql, creatorId ? [now, creatorId] : [now]);

      const refSql = creatorId
        ? `UPDATE referral_earnings SET status='paid', paid_at=? WHERE status='pending' AND referrer_id=?`
        : `UPDATE referral_earnings SET status='paid', paid_at=? WHERE status='pending'`;
      settledReferrals = await d1Run(refSql, creatorId ? [now, creatorId] : [now]);

      // Audit trail: record who settled what, and when. Previously a month-end payout
      // left no record of the actor or the counts.
      await d1Query(
        `INSERT INTO settle_audit (id, actor, scope, creators, referrals, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId("settle"), "admin-token", creatorId ?? "all", settledCreators, settledReferrals, now],
      );
    } catch (e) {
      return NextResponse.json({ error: { code: "db_error", message: String(e) } }, { status: 500 });
    }
  }

  // Memory mirror — only flips rows the D1 statement just settled.
  for (const e of earningsStore().values()) {
    if (e.status !== "pending") continue;
    if (creatorId && e.creator_id !== creatorId) continue;
    e.status = "paid";
    e.paid_at = now;
    if (!D1_ENABLED) settledCreators++;
  }
  for (const e of referralEarningsStore().values()) {
    if (e.status !== "pending") continue;
    if (creatorId && e.referrer_id !== creatorId) continue;
    e.status = "paid";
    e.paid_at = now;
    if (!D1_ENABLED) settledReferrals++;
  }

  return NextResponse.json({
    ok: true,
    settled_creators: settledCreators,
    settled_referrals: settledReferrals,
    settled_at: now,
  });
}
