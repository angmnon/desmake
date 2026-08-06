import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrder, ordersStore, persistOrder, recordOrderEarnings } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { recordError, notifyAlert } from "@/lib/monitor";

// No edge runtime — reads the order store and verifies the Stripe PaymentIntent (R2/C1).

function markPaid(order: import("@/lib/stores").OrderRecord, paymentIntentId: string, ref: string): void {
  const now = Date.now();
  order.status = "paid";
  order.payment.method = "card";
  order.payment.payment_intent_id = paymentIntentId;
  order.payment.paid_at = new Date(now).toISOString();
  order.payment.ref = ref || order.payment.ref;
  order.updated_at = order.payment.paid_at;
  order.history = [
    ...order.history,
    { status: "paid", note: "Payment confirmed", ts: order.payment.paid_at },
    { status: "routing", note: "Matching to nearest manufacturer", ts: order.payment.paid_at },
  ];
  order.manufacturing.status = "routing";
  ordersStore().set(order.order_id, order);
  void persistOrder(order).catch(() => {});
  // M3: 支付成功后把各订单行的创作者分成写入 creator_earnings（status=pending）。
  void recordOrderEarnings(order).catch(() => {});
}

/**
 * Confirm payment for an order that is currently "pending".
 *
 * With a real gateway wired in, the client passes the Stripe `payment_intent_id`
 * produced by confirming the card in the browser. We re-verify it server-side
 * (status === succeeded, amount + currency match the order) before marking paid —
 * the client can never mark an order paid on its own.
 */
export async function POST(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to pay" } }, { status: 401 });
  }

  // WAF-style throttle on payment confirmation.
  const rl = rateLimit(`${clientIp(request)}:pay-confirm`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many confirmation attempts — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }
  const orderId = typeof (body as { order_id?: unknown }).order_id === "string" ? (body as { order_id: string }).order_id : "";
  const paymentIntentId =
    typeof (body as { payment_intent_id?: unknown }).payment_intent_id === "string"
      ? (body as { payment_intent_id: string }).payment_intent_id
      : "";

  const order = await getOrder(orderId);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Order not found" } }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: { code: "conflict", message: "Order is not awaiting payment" } }, { status: 409 });
  }

  // ── Real gateway path: verify the Stripe PaymentIntent server-side ──
  if (STRIPE_ENABLED && stripe && paymentIntentId) {
    let intent;
    try {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      recordError("/api/payments/confirm", err);
      void notifyAlert("Payment confirm lookup failed", `order ${orderId}`);
      return NextResponse.json({ error: { code: "payment_lookup_failed", message: "Could not verify payment" } }, { status: 402 });
    }
    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: { code: "payment_incomplete", message: `Payment is ${intent.status}, not completed` } },
        { status: 402 },
      );
    }
    const expectedAmount = order.pricing.total_cents;
    const expectedCurrency = (order.pricing.currency || "usd").toLowerCase();
    if (intent.amount !== expectedAmount || intent.currency !== expectedCurrency) {
      recordError("/api/payments/confirm", `amount mismatch order ${orderId}`);
      return NextResponse.json(
        { error: { code: "amount_mismatch", message: "Payment amount does not match the order" } },
        { status: 409 },
      );
    }
    // Guard against double-confirm with a different intent that isn't ours.
    if (order.payment.payment_intent_id && order.payment.payment_intent_id !== intent.id) {
      recordError("/api/payments/confirm", `intent mismatch order ${orderId}`);
      return NextResponse.json({ error: { code: "intent_mismatch", message: "Payment intent does not match this order" } }, { status: 409 });
    }
    markPaid(order, intent.id, intent.id);
    return NextResponse.json({
      order_id: order.order_id,
      status: order.status,
      payment_ref: order.payment.ref,
      payment_intent_id: intent.id,
      total_cents: order.pricing.total_cents,
      paid_at: order.payment.paid_at,
    });
  }

  // ── Fallback (no gateway configured): legacy placeholder behaviour ──
  // Kept only so the app still "works" in a no-Stripe build. In production a
  // payment_intent_id is always supplied, so this branch is effectively dead.
  markPaid(order, paymentIntentId, order.payment.ref);
  return NextResponse.json({
    order_id: order.order_id,
    status: order.status,
    payment_ref: order.payment.ref,
    total_cents: order.pricing.total_cents,
    paid_at: order.payment.paid_at,
  });
}
