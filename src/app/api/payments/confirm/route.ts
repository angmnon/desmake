import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrder, ordersStore, persistOrder, recordOrderEarnings, recordReferralEarnings } from "@/lib/stores";
import { getSessionAsync, SESSION_COOKIE, runDurable } from "@/lib/session";
import { STRIPE_ENABLED } from "@/lib/stripe";
import { retrievePaymentIntent } from "@/lib/stripeFetch";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { recordError, notifyAlert } from "@/lib/monitor";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { sendMetaCapiPurchase } from "@/lib/capi";

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
  // H-9: keep the durable write alive past the response instead of a bare void+catch.
  runDurable("persistOrder", persistOrder(order));
  // M3: 支付成功后把各订单行的创作者分成写入 creator_earnings（status=pending）。
  // H-9: 分成是钱，写入失败绝不能静默吞掉 —— 必须告警，否则创作者白干活且无人知晓。
  runDurable(
    "recordOrderEarnings",
    recordOrderEarnings(order).catch((err) => {
      recordError("markPaid.recordOrderEarnings", err);
      void notifyAlert("Creator earnings write FAILED", `order ${order.order_id} — royalties were not recorded`);
    }),
  );
  // M-UGC: 同时把推荐分成写入 referral_earnings（status=pending）。反自推兜底在
  // recordReferralEarnings 内完成；无 referrer_id 时该函数直接返回（noop）。
  runDurable(
    "recordReferralEarnings",
    recordReferralEarnings(order).catch((err) => {
      recordError("markPaid.recordReferralEarnings", err);
      void notifyAlert("Referral earnings write FAILED", `order ${order.order_id} — referral commission was not recorded`);
    }),
  );
}

/**
 * P1 + P0-2: post-payment side effects — order confirmation email and the
 * server-side Meta CAPI `Purchase` event for ad-attribution. Best-effort; never
 * blocks the order response.
 */
function firePaidSideEffects(order: import("@/lib/stores").OrderRecord, request: NextRequest): void {
  void sendOrderConfirmationEmail(order).catch(() => {});
  void sendMetaCapiPurchase(order, request).catch(() => {});
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
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
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
    // H-3/F6: idempotent replay. The order is already paid — the client retried after
    // a lost response, or the webhook finalised it first. Returning 409 here made the
    // UI show "Payment could not be confirmed" for a charge that had in fact
    // succeeded, leaving the buyer with no way forward.
    if (order.status === "paid") {
      return NextResponse.json({
        order_id: order.order_id,
        status: order.status,
        payment_ref: order.payment.ref,
        payment_intent_id: order.payment.payment_intent_id ?? null,
        total_cents: order.pricing.total_cents,
        paid_at: order.payment.paid_at,
        idempotent_replay: true,
      });
    }
    return NextResponse.json({ error: { code: "conflict", message: "Order is not awaiting payment" } }, { status: 409 });
  }

  // ── Real gateway path: verify the Stripe PaymentIntent server-side ──
  if (STRIPE_ENABLED) {
    // Stripe is configured, so a real, server-verified PaymentIntent is MANDATORY.
    // A client that omits payment_intent_id must be rejected, never silently
    // accepted — otherwise any buyer could mark their own order paid for free.
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: { code: "payment_intent_required", message: "A verified Stripe payment intent is required to confirm this order" } },
        { status: 400 },
      );
    }
    let intent;
    try {
      intent = await retrievePaymentIntent(paymentIntentId);
    } catch (err) {
      recordError("/api/payments/confirm", err);
      void notifyAlert("Payment confirm lookup failed", `order ${orderId}`);
      return NextResponse.json({ error: { code: "payment_lookup_failed", message: "Could not verify payment" } }, { status: 402 });
    }
    if (!intent) {
      recordError("/api/payments/confirm", "intent not found: " + paymentIntentId);
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
    // C-1 (critical): bind the PaymentIntent to THIS specific order. The amount/
    // currency checks above only prove *a* payment of the right size succeeded —
    // without binding, one real payment could be replayed to confirm any number
    // of same-amount orders, shipping goods and paying royalties for free.
    const intentOrderId =
      typeof (intent.metadata as { order_id?: unknown } | null | undefined)?.order_id === "string"
        ? (intent.metadata as { order_id: string }).order_id
        : "";
    if (intentOrderId !== orderId) {
      recordError("/api/payments/confirm", `intent/order mismatch: intent ${intent.id} belongs to "${intentOrderId || "(none)"}" not ${orderId}`);
      return NextResponse.json(
        { error: { code: "intent_order_mismatch", message: "Payment intent does not belong to this order" } },
        { status: 409 },
      );
    }
    // Guard against double-confirm with a different intent that isn't ours.
    if (order.payment.payment_intent_id && order.payment.payment_intent_id !== intent.id) {
      recordError("/api/payments/confirm", `intent mismatch order ${orderId}`);
      return NextResponse.json({ error: { code: "intent_mismatch", message: "Payment intent does not match this order" } }, { status: 409 });
    }
    markPaid(order, intent.id, intent.id);
    firePaidSideEffects(order, request);
    return NextResponse.json({
      order_id: order.order_id,
      status: order.status,
      payment_ref: order.payment.ref,
      payment_intent_id: intent.id,
      total_cents: order.pricing.total_cents,
      paid_at: order.payment.paid_at,
    });
  }

  // ── No gateway configured ──
  // In production a verified gateway is mandatory. Allowing a free markPaid here would
  // let anyone confirm their own order without paying (P0-4). Refuse and alert.
  // R2 hardening: treat everything except an explicit `development` build as production,
  // so the free path can never be reached by a non-"production" runtime value.
  if (process.env.NODE_ENV !== "development") {
    recordError("/api/payments/confirm", "stripe disabled in production — refusing markPaid");
    void notifyAlert("Payment gateway unavailable", `order ${orderId} cannot be confirmed: Stripe not enabled in production`);
    return NextResponse.json(
      { error: { code: "payment_gateway_unavailable", message: "Payment is temporarily unavailable. Please try again later." } },
      { status: 503 },
    );
  }
  markPaid(order, paymentIntentId, order.payment.ref);
  firePaidSideEffects(order, request);
  return NextResponse.json({
    order_id: order.order_id,
    status: order.status,
    payment_ref: order.payment.ref,
    total_cents: order.pricing.total_cents,
    paid_at: order.payment.paid_at,
  });
}
