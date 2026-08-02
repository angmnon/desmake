import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ordersStore, persistOrder } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";

// No edge runtime — reads the in-memory order store (R2/C1).

/**
 * Confirm payment for an order that is currently "pending".
 *
 * This is the single choke point where a real payment gateway would verify its
 * callback/webhook (signature, amount, provider reference) and mark the order paid.
 * Until a provider is wired in, this acts as the checkout "pay now" step, flipping
 * the order from pending → paid and recording the payment details.
 */
export async function POST(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to pay" } }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }
  const orderId = typeof (body as { order_id?: unknown }).order_id === "string" ? (body as { order_id: string }).order_id : "";

  const order = ordersStore().get(orderId);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Order not found" } }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: { code: "conflict", message: "Order is not awaiting payment" } }, { status: 409 });
  }

  const now = Date.now();
  order.status = "paid";
  order.payment.method = "card"; // placeholder — a real gateway sets provider + ref here
  order.payment.paid_at = new Date(now).toISOString();
  order.updated_at = order.payment.paid_at;
  order.history = [
    ...order.history,
    { status: "paid", note: "Payment confirmed", ts: order.payment.paid_at },
    { status: "routing", note: "Matching to nearest manufacturer", ts: order.payment.paid_at },
  ];
  order.manufacturing.status = "routing";
  ordersStore().set(order.order_id, order);
  void persistOrder(order).catch(() => {});

  return NextResponse.json({
    order_id: order.order_id,
    status: order.status,
    payment_ref: order.payment.ref,
    total_cents: order.pricing.total_cents,
    paid_at: order.payment.paid_at,
  });
}
