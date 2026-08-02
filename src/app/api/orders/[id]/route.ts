import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ordersStore, idCreatedTs } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";

// No edge runtime — this route reads the in-memory order store off `globalThis` (R2/C1).

const STATUSES = ["paid", "routing", "in_production", "quality_check", "shipped", "delivered"] as const;
// Elapsed-time thresholds (ms) after which each status becomes active.
const STATUS_THRESHOLDS: Record<string, number> = {
  paid: 0,
  routing: 800,
  in_production: 2500,
  quality_check: 5500,
  shipped: 9000,
  delivered: 13000,
};
const STATUS_NOTES: Record<string, string> = {
  paid: "Payment confirmed",
  routing: "Matching to nearest manufacturer",
  in_production: "Production in progress",
  quality_check: "Quality inspection",
  shipped: "Shipped — tracking available",
  delivered: "Delivered",
};

function currentStatus(ageMs: number): string {
  let s = "paid";
  for (const st of STATUSES) {
    if (ageMs >= (STATUS_THRESHOLDS[st] || 0)) s = st;
  }
  return s;
}

type HistoryEntry = { status: string; note: string; ts: string };

function buildHistory(ageMs: number): HistoryEntry[] {
  const createdTs = Date.now() - ageMs;
  const hist: HistoryEntry[] = [];
  for (const st of STATUSES) {
    const t = STATUS_THRESHOLDS[st] || 0;
    if (ageMs >= t) {
      hist.push({ status: st, note: STATUS_NOTES[st] ?? st, ts: new Date(createdTs + t).toISOString() });
    }
  }
  return hist;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Order details contain PII — require an authenticated session.
  const user = getSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view this order" } }, { status: 401 });
  }

  const { id } = await params;

  // NEVER synthesize an order for an unknown id. A miss is a 404.
  const order = ordersStore().get(id);
  // R2/H1: ownership check. Previously any signed-in user who guessed an order id
  // could read the full record — customer name, email and shipping address included.
  // A foreign id is reported as 404, not 403, so the endpoint does not confirm that
  // an order with that id exists.
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Order not found" } }, { status: 404 });
  }

  // Advance state based on age (real persisted order only) — but never before the
  // order has been PAID. A pending order stays pending until /api/payments/confirm.
  const age = Date.now() - (order._created_ts || idCreatedTs(order.order_id));
  if (order.status !== "pending") {
    const status = currentStatus(age);
    if (status !== order.manufacturing.status) {
      order.manufacturing.status = status;
      if (["in_production", "quality_check", "shipped", "delivered"].includes(status)) {
        order.manufacturing.facility_id = order.manufacturing.facility_id || "fac_us-west-03";
      }
      if (["shipped", "delivered"].includes(status)) {
        order.manufacturing.tracking = order.manufacturing.tracking || "1Z999AA10123456784";
      }
      order.updated_at = new Date().toISOString();
      order.history = buildHistory(age);
    }
  }

  return NextResponse.json({
    order_id: order.order_id,
    status: order.status,
    payment: order.payment,
    items: order.items,
    customer: order.customer,
    shipping: order.shipping,
    pricing: order.pricing,
    manufacturing: order.manufacturing,
    history: order.history,
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
}
