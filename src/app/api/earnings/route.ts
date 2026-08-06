import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { getEarningsForUser, listEarningsForUser } from "@/lib/stores";

// No edge runtime — reads the earnings store / D1 off `globalThis` (R2/C1).

export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view earnings" } }, { status: 401 });
  }
  const summary = await getEarningsForUser(user.id);
  // 附带最近若干条 pending 明细，便于创作者核对。
  const recent = (await listEarningsForUser(user.id, 25)).map((e) => ({
      id: e.id,
      order_id: e.order_id,
      design_slug: e.design_slug,
      royalty_rate: e.royalty_rate,
      royalty_cents: e.royalty_cents,
      status: e.status,
      created_at: e.created_at,
      paid_at: e.paid_at,
    }));
  return NextResponse.json({ summary, recent }, { headers: { "Cache-Control": "no-store" } });
}
