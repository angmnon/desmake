import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { getEarningsForUser, listEarningsForUser, getReferralEarningsForUser, listReferralEarningsForUser } from "@/lib/stores";

// No edge runtime — reads the earnings store / D1 off `globalThis` (R2/C1).

export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view earnings" } }, { status: 401 });
  }

  const creatorSummary = await getEarningsForUser(user.id);
  const referralSummary = await getReferralEarningsForUser(user.id);

  // 最近若干条明细：创作者分成 + 推荐分成，便于创作者核对。
  const creatorRecent = (await listEarningsForUser(user.id, 15)).map((e) => ({
    kind: "creator" as const,
    id: e.id,
    order_id: e.order_id,
    design_slug: e.design_slug,
    rate: e.royalty_rate,
    cents: e.royalty_cents,
    status: e.status,
    created_at: e.created_at,
    paid_at: e.paid_at,
  }));
  const referralRecent = (await listReferralEarningsForUser(user.id, 15)).map((e) => ({
    kind: "referral" as const,
    id: e.id,
    order_id: e.order_id,
    design_slug: e.source_design_slug,
    rate: e.commission_rate,
    cents: e.commission_cents,
    status: e.status,
    created_at: e.created_at,
    paid_at: e.paid_at,
  }));

  const recent = [...creatorRecent, ...referralRecent]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 20);

  return NextResponse.json(
    { creator: creatorSummary, referral: referralSummary, recent },
    { headers: { "Cache-Control": "no-store" } },
  );
}
