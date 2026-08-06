import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { d1Query, D1_ENABLED } from "@/lib/db";
import { earningsStore } from "@/lib/stores";

// 月结手动打款端点：运营用 ADMIN_TOKEN 触发，把 creator_earnings 的 pending → paid。
// 不对外暴露，仅运营后台使用。

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
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
  let settled = 0;

  // 内存层更新
  for (const e of earningsStore().values()) {
    if (e.status !== "pending") continue;
    if (creatorId && e.creator_id !== creatorId) continue;
    e.status = "paid";
    e.paid_at = now;
    settled++;
  }

  // D1 持久层更新（幂等）
  if (D1_ENABLED) {
    try {
      const sql = creatorId
        ? `UPDATE creator_earnings SET status='paid', paid_at=? WHERE status='pending' AND creator_id=?`
        : `UPDATE creator_earnings SET status='paid', paid_at=? WHERE status='pending'`;
      const params = creatorId ? [now, creatorId] : [now];
      await d1Query(sql, params);
    } catch (e) {
      return NextResponse.json({ error: { code: "db_error", message: String(e) } }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, settled, settled_at: now });
}
