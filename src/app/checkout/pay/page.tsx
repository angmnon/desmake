"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShieldCheck, Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { money, adapterName } from "@/lib/data";

type PayOrder = {
  order_id: string;
  status: string;
  payment: { ref: string; method: string | null; paid_at: string | null; payment_intent_id?: string | null };
  items: Array<{ title: string; adapter: string; variant: string; quantity: number; unit_price_cents: number }>;
  pricing: { subtotal_cents: number; tax_cents: number; shipping_cents: number; total_cents: number; currency: string };
};

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: "15px",
      color: "#0c0c0d",
      "::placeholder": { color: "#9a9a9a" },
      iconColor: "#0c0c0d",
    },
    invalid: { color: "#d9534f", iconColor: "#d9534f" },
  },
};

function PayForm({ order, orderId, onPaid }: { order: PayOrder; orderId: string; onPaid: (o: PayOrder) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { client_secret?: string; error?: { message?: string } };
        if (!r.ok || !data.client_secret) throw new Error(data.error?.message || "Could not start payment");
        if (!cancelled) setClientSecret(data.client_secret);
      })
      .catch((e) => { if (!cancelled) setInitError(e instanceof Error ? e.message : "Could not start payment"); });
    return () => { cancelled = true; };
  }, [orderId]);

  const pay = async () => {
    if (!stripe || !elements || !clientSecret) return;
    setPaying(true);
    setError(null);
    const card = elements.getElement(CardElement);
    if (!card) { setError("Card input is not ready"); setPaying(false); return; }

    const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });
    if (stripeErr) {
      setError(stripeErr.message || "Payment failed");
      setPaying(false);
      return;
    }
    if (paymentIntent?.status !== "succeeded") {
      setError("Payment was not completed");
      setPaying(false);
      return;
    }

    // Server-side verification before marking the order paid.
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, payment_intent_id: paymentIntent.id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Payment could not be confirmed");
      }
      onPaid({ ...order, status: "paid", payment: { ...order.payment, method: "card", paid_at: new Date().toISOString(), payment_intent_id: paymentIntent.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (initError) {
    return (
      <div className="tiny" role="alert" style={{ color: "var(--color-signal)", textAlign: "left" }}>{initError}</div>
    );
  }

  return (
    <>
      <div className="card" style={{ padding: 24, maxWidth: 460, margin: "0 auto 16px", textAlign: "left" }}>
        <div className="label mb-3">Card details</div>
        <div className="input" style={{ padding: "12px 14px", borderRadius: 10, background: "#fff" }}>
          <CardElement options={CARD_OPTIONS} />
        </div>
        <div className="row gap-2 mt-4">
          <span className="tag mono"><ShieldCheck size={11} /> Buyer protection</span>
          <span className="tag mono"><Lock size={11} /> Secure</span>
        </div>
      </div>
      {error && <div className="tiny" role="alert" style={{ color: "var(--color-signal)", marginBottom: 12, textAlign: "center" }}>{error}</div>}
      <button onClick={pay} disabled={paying || !stripe || !clientSecret} className="btn btn-lg full center" style={{ maxWidth: 460, margin: "0 auto" }}>
        {paying ? <><Loader2 size={18} className="animate-spin" /> Processing payment…</> : <>Pay {money(order.pricing.total_cents)} <ArrowRight size={18} strokeWidth={1.8} /></>}
      </button>
    </>
  );
}

function PayPage() {
  const params = useSearchParams();
  const orderId = params.get("order") || "";
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

  const total = order.pricing.total_cents;

  if (done) {
    return (
      <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
        <div className="container-narrow center">
          <span className="eyebrow eyebrow-dot">Payment</span>
          <h1 className="h1 balance" style={{ marginTop: 14 }}>Payment complete</h1>
          <p className="small muted" style={{ margin: "10px auto 28px" }}>Order <span className="mono">{order.order_id}</span></p>
          <div className="card" style={{ padding: 32, maxWidth: 460, margin: "0 auto 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--color-moss)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#fff" }}>
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

  if (!stripePromise) {
    return (
      <section className="section"><div className="container-narrow center"><p className="small muted">Payment is not configured.</p></div></section>
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
                <span className="truncate">{it.title} <span className="faint">· {adapterName(it.adapter)} {it.variant} ×{it.quantity}</span></span>
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

        <Elements stripe={stripePromise}>
          <PayForm order={order} orderId={orderId} onPaid={() => setDone(true)} />
        </Elements>

        <div className="tiny muted center mt-4" style={{ maxWidth: 460, margin: "14px auto 0" }}>
          <Link href="/cart" className="link-u small">Cancel and return to cart</Link>
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
