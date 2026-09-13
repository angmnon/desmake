import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrder, ordersStore, persistOrder, type OrderRecord } from "@/lib/stores";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { STRIPE_ENABLED, STRIPE_PUBLISHABLE_KEY } from "@/lib/stripe";
import { createPaymentIntent, retrievePaymentIntent } from "@/lib/stripeFetch";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// No edge runtime — reads the order store and talks to Stripe (Node SDK).

/**
 * Create a Stripe PaymentIntent for a pending order and return its client_secret
 * so the browser can confirm the card without ever touching raw card data.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
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

  if (!STRIPE_ENABLED) {
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

  let intentId = order.payment.payment_intent_id ?? undefined;
  let intent = intentId ? await retrievePaymentIntent(intentId) : null;

  // C-5 (critical): an already-succeeded intent must NEVER be replaced.
  //
  // The old condition lumped "succeeded" in with "canceled" and minted a brand-new
  // PaymentIntent, overwriting `payment_intent_id`. A buyer whose confirm step failed
  // (or who simply reloaded the pay page) was therefore charged a second full amount
  // while the order stayed `pending`. Reuse the succeeded intent and tell the client
  // to finalise instead of paying again.
  if (intent && intent.status === "succeeded") {
    return NextResponse.json({
      client_secret: intent.client_secret,
      amount,
      currency,
      publishable_key: STRIPE_PUBLISHABLE_KEY,
      already_paid: true,
    });
  }

  if (!intent || intent.status === "canceled") {
    try {
      intent = await createPaymentIntent({
        amount,
        currency,
        receiptEmail: order.customer.email || undefined,
        metadata: { order_id: order.order_id, user_id: user.id },
      });
    } catch (e) {
      // F3: previously unhandled — any Stripe rejection became a bare 500 that left
      // the order stranded in `pending` with no operator signal. Surfacing the real
      // Stripe error (not just a generic message) so a hang/timeout is diagnosable.
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[payments] createPaymentIntent failed:", detail);
      return NextResponse.json(
        { error: { code: "payment_unavailable", message: "Could not start the payment. Please try again.", detail } },
        { status: 502 },
      );
    }
    order.payment.payment_intent_id = intent.id;
    ordersStore().set(order.order_id, order);
    // H-9: keep the write alive past the response instead of a bare void+catch.
    const guarded = persistOrder(order).catch((e: unknown) => {
      console.error("[payments] persistOrder failed:", e instanceof Error ? e.message : e);
    });
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const ctx = (getCloudflareContext() as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)?.ctx;
      if (ctx?.waitUntil) {
        ctx.waitUntil(guarded);
      } else {
        void guarded;
      }
    } catch {
      void guarded;
    }
  }

  if (!intent) {
    return NextResponse.json(
      { error: { code: "payment_unavailable", message: "Could not start the payment. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({
    client_secret: intent.client_secret,
    amount,
    currency,
    publishable_key: STRIPE_PUBLISHABLE_KEY,
    already_paid: false,
  });
}
