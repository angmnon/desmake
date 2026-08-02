"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, ArrowRight, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { money, adapterName } from "@/lib/data";

type PayOrder = {
  order_id: string;
  status: string;
  payment: { ref: string; method: string | null; paid_at: string | null };
  items: Array<{ title: string; adapter: string; variant: string; quantity: number; unit_price_cents: number }>;
  pricing: { subtotal_cents: number; tax_cents: number; shipping_cents: number; total_cents: number; currency: string };
};

function PayPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("order") || "";
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [paying, setPaying] = useState(false);
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
      .then((o) => { if (o) setOrder(o); })
      .catch(() => setError("Could not load this order."));
  }, [orderId]);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.status === 401) { setUnauth(true); return; }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Payment could not be confirmed");
      }
      setDone(true);
      setOrder((o) => (o ? { ...o, status: "paid", payment: { ...o.payment, method: "card", paid_at: new Date().toISOString() } } : o));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (unauth) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,8vw,96px) 24px" }}>
        <h1 className="h2 balance">Sign in to continue</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>You need an account to pay for this order.</p>
        <Link href={`/auth?next=${encodeURIComponent(`/checkout/pay?order=${orderId}`)}`} className="btn btn-lg">Sign in <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  if (!order && !error) {
    return (
      <section className="section"><div className="container-narrow center"><p className="small muted">Loading order…</p></div></section>
    );
  }
  if (!order) {
    return (
      <section className="section"><div className="container-narrow center"><p className="small muted">{error}</p></div></section>
    );
  }

  const total = order.pricing.total_cents;

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-narrow center">
        <span className="eyebrow eyebrow-dot">Payment</span>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>{done ? "Payment complete" : "Complete your payment"}</h1>
        <p className="small muted" style={{ margin: "10px auto 28px" }}>
          Order <span className="mono">{order.order_id}</span>
        </p>

        {done ? (
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
        ) : (
          <>
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
              <div className="row gap-2 mt-4">
                <span className="tag mono"><ShieldCheck size={11} /> Buyer protection</span>
                <span className="tag mono"><Lock size={11} /> Secure</span>
              </div>
            </div>

            {/* Payment method placeholder — a real gateway (Stripe/WeChat) renders its
                hosted/checkout UI here; until configured, "Confirm payment" advances the
                order to paid via the server-side confirm endpoint. */}
            <div className="card" style={{ padding: 24, maxWidth: 460, margin: "0 auto 16px", textAlign: "left" }}>
              <div className="label mb-3">Payment method</div>
              <div className="row gap-2 wrap">
                {["Visa", "Mastercard", "Amex", "PayPal"].map((p) => (
                  <span key={p} className="chip" style={{ opacity: 0.75 }}><CreditCard size={13} /> {p}</span>
                ))}
              </div>
              <div className="tiny muted" style={{ marginTop: 10 }}>
                A payment provider will be wired in here. For now the order is confirmed server-side.
              </div>
            </div>

            {error && <div className="tiny" role="alert" style={{ color: "var(--color-signal)", marginBottom: 12 }}>{error}</div>}

            <button onClick={pay} disabled={paying} className="btn btn-lg full center" style={{ maxWidth: 460, margin: "0 auto" }}>
              {paying ? <><Loader2 size={18} className="animate-spin" /> Confirming payment…</> : <>Confirm payment · {money(total)} <ArrowRight size={18} strokeWidth={1.8} /></>}
            </button>
            <div className="tiny muted center mt-4" style={{ maxWidth: 460, margin: "14px auto 0" }}>
              <Link href="/cart" className="link-u small">Cancel and return to cart</Link>
            </div>
          </>
        )}
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
