import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrder, ordersStore, persistOrder } from "@/lib/stores";
import { stripe, STRIPE_ENABLED, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { recordError } from "@/lib/monitor";

// No edge runtime — needs the raw request body to verify the Stripe signature.

/**
 * Stripe webhook endpoint. Verifies the signature with STRIPE_WEBHOOK_SECRET and,
 * on a successful PaymentIntent, marks the corresponding order paid. This is the
 * authoritative async confirmation and a safety net in case the client-side
 * `payment_intent.succeeded` event arrives before /api/payments/confirm is called.
 */
export async function POST(request: NextRequest) {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "payment provider not configured" }, { status: 503 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid signature";
    recordError("/api/payments/webhook", err);
    return NextResponse.json({ error: `webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
    const orderId = pi.metadata?.order_id;
    if (orderId) {
      const order = await getOrder(orderId);
      if (order && order.status === "pending") {
        const now = Date.now();
        const paidAt = new Date(now).toISOString();
        order.status = "paid";
        order.payment.method = "card";
        order.payment.payment_intent_id = pi.id;
        order.payment.paid_at = paidAt;
        order.payment.ref = pi.id;
        order.updated_at = paidAt;
        order.history = [
          ...order.history,
          { status: "paid", note: "Payment confirmed via webhook", ts: paidAt },
          { status: "routing", note: "Matching to nearest manufacturer", ts: paidAt },
        ];
        order.manufacturing.status = "routing";
        ordersStore().set(order.order_id, order);
        void persistOrder(order).catch(() => {});
      }
    }
  }

  return NextResponse.json({ received: true });
}
