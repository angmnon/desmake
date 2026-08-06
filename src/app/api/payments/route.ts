import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrder, ordersStore, persistOrder, type OrderRecord } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { stripe, STRIPE_ENABLED, STRIPE_PUBLISHABLE_KEY } from "@/lib/stripe";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// No edge runtime — reads the order store and talks to Stripe (Node SDK).

/**
 * Create a Stripe PaymentIntent for a pending order and return its client_secret
 * so the browser can confirm the card without ever touching raw card data.
 */
export async function POST(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to pay" } }, { status: 401 });
  }

  // WAF-style throttle on payment initiation.
  const rl = rateLimit(`${clientIp(request)}:payments`, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many payment attempts — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json(
      { error: { code: "payment_unavailable", message: "Payment provider is not configured" } },
      { status: 503 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }
  const orderId = typeof (body as { order_id?: unknown }).order_id === "string" ? (body as { order_id: string }).order_id : "";
  if (!orderId) {
    return NextResponse.json({ error: { code: "validation", message: "order_id is required" } }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Order not found" } }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: { code: "conflict", message: "Order is not awaiting payment" } }, { status: 409 });
  }

  const amount = order.pricing.total_cents;
  const currency = (order.pricing.currency || "usd").toLowerCase();

  // Reuse an existing intent if one is already attached and still open, otherwise
  // create a fresh one. Avoids duplicate intents when the pay page is reloaded.
  let intentId = order.payment.payment_intent_id ?? undefined;
  let intent = intentId ? await stripe.paymentIntents.retrieve(intentId).catch(() => null) : null;
  if (!intent || intent.status === "succeeded" || intent.status === "canceled") {
    intent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: order.customer.email || undefined,
      metadata: { order_id: order.order_id, user_id: user.id },
      automatic_payment_methods: { enabled: true },
    });
    order.payment.payment_intent_id = intent.id;
    ordersStore().set(order.order_id, order);
    void persistOrder(order).catch(() => {});
  }

  return NextResponse.json({
    client_secret: intent.client_secret,
    amount,
    currency,
    publishable_key: STRIPE_PUBLISHABLE_KEY,
  });
}
