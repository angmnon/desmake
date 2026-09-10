"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { money, adapterName } from "@/lib/data";
import { track } from "@/lib/tracking";
import { useCart } from "@/lib/cart";

// P2-1: Stripe is loaded lazily. The payment UI (which pulls in @stripe/stripe-js and
// fetches js.stripe.com/v3) is a separate client chunk mounted only once the order is
// resolved, so it never blocks first paint of the checkout page.
const StripeCheckout = dynamic(() => import("@/components/StripeCheckout"), {
  ssr: false,
  loading: () => <div className="tiny muted center" style={{ maxWidth: 460, margin: "0 auto" }}>Loading payment…</div>,
});

type PayOrder = {
  order_id: string;
  status: string;
  payment: { ref: string; method: string | null; paid_at: string | null; payment_intent_id?: string | null };
  items: Array<{ title: string; adapter: string; variant: string; quantity: number; unit_price_cents: number }>;
  pricing: { subtotal_cents: number; tax_cents: number; shipping_cents: number; total_cents: number; currency: string };
};

function PayPage() {
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  // H-5: the cart is now cleared here — on confirmed payment — instead of at order
  // creation. Previously `cart.clear()` ran the moment the pending order was made, so
  // a declined card, a closed tab or a changed mind destroyed the buyer's cart with
  // no way to recover it, and the pending order could never be resumed from the UI.
  const cart = useCart();
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauth, setUnauth] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${encodeURIComponent(orderId)}`)
      .then(async (r) => {
        if (r.status === 401) { setUnauth(true); return null; }
        if (!r.ok) throw new Error("Order not found");
        return (await r.json()) as PayOrder;
      })
      .then((o) => {
        if (o) {
          setOrder(o);
          if (o.status === "paid") setDone(true);
        }
      })
      .catch(() => setError("Could not load this order."))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (unauth) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,8vw,96px) 24px" }}>
        <h1 className="h2 balance">Sign in to continue</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>You need an account to pay for this order.</p>
        <Link href={`/auth?next=${encodeURIComponent(`/checkout/pay?order=${orderId}`)}`} className="btn btn-lg">Sign in <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  if (loading || !order) {
    return (
      <section className="section"><div className="container-narrow center"><p className="small muted">{loading ? "Loading order…" : error || "Order not found."}</p></div></section>
    );
  }

  // P0-2: fire the server-confirmed purchase event once, on the payment transition
  // (not when an already-paid order is merely reloaded).
  const handlePaid = (o: PayOrder) => {
    setDone(true);
    // H-5: only now — after the payment is genuinely confirmed — is it safe to clear.
    cart.clear();
    track("purchase", {
      currency: o.pricing.currency || "USD",
      value: o.pricing.total_cents / 100,
      transaction_id: o.order_id,
      items: o.items.map((it) => ({
        item_id: it.title,
        item_name: it.title,
        price: it.unit_price_cents / 100,
        quantity: it.quantity,
      })),
    });
  };

  const total = order.pricing.total_cents;

  if (done) {
    return (
      <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
        <div className="container-narrow center">
          <span className="eyebrow eyebrow-dot">Payment</span>
          <h1 className="h1 balance" style={{ marginTop: 14 }}>Payment complete</h1>
          <p className="small muted" style={{ margin: "10px auto 28px" }}>Order <span className="mono">{order.order_id}</span></p>
          <div className="card" style={{ padding: 32, maxWidth: 460, margin: "0 auto 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#fff" }}>
              <CheckCircle2 size={28} strokeWidth={1.8} />
            </div>
            <h3 className="h3" style={{ marginBottom: 8 }}>Your payment was confirmed</h3>
            <p className="small muted" style={{ marginBottom: 18 }}>The order is now being routed to manufacturing. You can track it from your orders page.</p>
            <div className="stack gap-2 mb-6" style={{ textAlign: "left" }}>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Amount paid</span><b>{money(total)}</b></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Method</span><b className="capitalize">{order.payment.method || "card"}</b></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Reference</span><b className="mono">{order.payment.ref}</b></div>
            </div>
            <Link href={`/orders/${order.order_id}`} className="btn btn-lg full center">Track your order <ArrowRight size={18} strokeWidth={1.8} /></Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-narrow center">
        <span className="eyebrow eyebrow-dot">Payment</span>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>Complete your payment</h1>
        <p className="small muted" style={{ margin: "10px auto 28px" }}>Order <span className="mono">{order.order_id}</span></p>

        <div className="card" style={{ padding: 24, maxWidth: 460, margin: "0 auto 16px", textAlign: "left" }}>
          <div className="stack gap-3 mb-4">
            {order.items.map((it, i) => (
              <div key={i} className="row-between small">
                <span className="truncate">{it.title} <span className="faint">· {adapterName(it.adapter)}{it.variant ? ` ${it.variant}` : ""} ×{it.quantity}</span></span>
                <span className="mono">{money(it.unit_price_cents * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="hr" />
          <div className="row-between mt-3">
            <span className="h5">Total due</span>
            <span className="h3 mono tnum">{money(total)}</span>
          </div>
        </div>

        <StripeCheckout order={order} orderId={orderId} onPaid={handlePaid} />

        <div className="tiny muted center mt-4" style={{ maxWidth: 460, margin: "14px auto 0" }}>
          <Link href="/cart" className="link-u small">Cancel and return to cart</Link>
          <p style={{ marginTop: 8 }}>
            Your cart is kept, and this order stays payable from{" "}
            <Link href="/orders" className="link-u">My orders</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function CheckoutPayPage() {
  return (
    <Suspense fallback={<section className="section"><div className="container-narrow center"><p className="small muted">Loading…</p></div></section>}>
      <PayPage />
    </Suspense>
  );
}
