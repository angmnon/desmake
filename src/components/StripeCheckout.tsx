"use client";

// P2-1: Stripe payment UI extracted into its own client chunk and loaded lazily via
// `next/dynamic` from the checkout page. Previously `@stripe/stripe-js`'s `loadStripe`
// ran at module top of the page, pulling `js.stripe.com/v3` before the order even
// finished loading. Now the Stripe script only fetches when this component mounts
// (i.e. once the order is resolved and the user reaches the payment step).

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShieldCheck, Lock, ArrowRight, Loader2 } from "lucide-react";
import { money } from "@/lib/data";
import { track } from "@/lib/tracking";

type PayOrder = {
  order_id: string;
  status: string;
  payment: { ref: string; method: string | null; paid_at: string | null; payment_intent_id?: string | null };
  items: Array<{ title: string; adapter: string; variant: string; quantity: number; unit_price_cents: number }>;
  pricing: { subtotal_cents: number; tax_cents: number; shipping_cents: number; total_cents: number; currency: string };
};

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

/** `pi_xxx_secret_yyy` → `pi_xxx`. Needed to finalise an already-paid intent. */
function intentIdFromSecret(secret: string): string {
  return secret.split("_secret_")[0] || "";
}

function InnerForm({
  order,
  orderId,
  clientSecret,
  onPaid,
}: {
  order: PayOrder;
  orderId: string;
  clientSecret: string;
  onPaid: (o: PayOrder) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmWithServer = useCallback(
    async (paymentIntentId: string) => {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, payment_intent_id: paymentIntentId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Payment could not be confirmed");
      }
      onPaid({
        ...order,
        status: "paid",
        payment: { ...order.payment, method: "card", paid_at: new Date().toISOString(), payment_intent_id: paymentIntentId },
      });
      try {
        track("purchase", { order_id: orderId, value: order.pricing.total_cents / 100, currency: order.pricing.currency });
      } catch {
        /* analytics must never break checkout */
      }
    },
    [onPaid, order, orderId],
  );

  const pay = async () => {
    if (!stripe || !elements || !clientSecret) return;
    setPaying(true);
    setError(null);
    const card = elements.getElement(CardElement);
    if (!card) {
      setError("Card input is not ready");
      setPaying(false);
      return;
    }

    // M-11: supply return_url so redirect-based methods (3DS, wallets) can come back,
    // instead of failing outright under automatic_payment_methods.
    const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
      return_url: typeof window !== "undefined" ? window.location.href : undefined,
    });

    if (stripeErr) {
      setError(stripeErr.message || "Payment failed");
      setPaying(false);
      return;
    }

    // M-11: `processing` is NOT a failure (async bank settlement). Treat it as success
    // and let the server verify — the old code rejected it and pushed buyers to retry,
    // which double-charged them.
    if (paymentIntent?.status !== "succeeded" && paymentIntent?.status !== "processing") {
      setError("Payment was not completed");
      setPaying(false);
      return;
    }

    try {
      await confirmWithServer(paymentIntent.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

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
      {error && (
        <div className="tiny" role="alert" style={{ color: "var(--color-ink)", marginBottom: 12, textAlign: "center", fontWeight: 500 }}>
          {error}
        </div>
      )}
      <button
        onClick={pay}
        disabled={paying || !stripe || !clientSecret}
        className="btn btn-lg full center"
        style={{ maxWidth: 460, margin: "0 auto" }}
      >
        {paying ? (
          <><Loader2 size={18} className="animate-spin" /> Processing payment…</>
        ) : (
          <>Pay {money(order.pricing.total_cents)} <ArrowRight size={18} strokeWidth={1.8} /></>
        )}
      </button>
    </>
  );
}

export default function StripeCheckout({ order, orderId, onPaid }: { order: PayOrder; orderId: string; onPaid: (o: PayOrder) => void }) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  // M-10: keep one Stripe instance per key — `loadStripe` in the render body rebuilt it
  // on every render and `Elements` silently ignored the changed `stripe` prop.
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInitError(null);
    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as {
          client_secret?: string;
          publishable_key?: string;
          already_paid?: boolean;
          error?: { message?: string };
        };
        if (!r.ok || !data.client_secret) throw new Error(data.error?.message || "Could not start payment");
        if (cancelled) return;
        // C-4 fix: prefer the key returned by the server. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        // is inlined at BUILD time and was never present in the deploy pipeline, so the
        // browser got an empty string and the whole payment UI collapsed to
        // "Payment is not configured." — i.e. the site could not take a single payment.
        const key = data.publishable_key || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
        if (!key) throw new Error("Payment is not configured. Please contact support.");
        setClientSecret(data.client_secret);
        setAlreadyPaid(Boolean(data.already_paid));
        setPublishableKey(key);
        if (loadedKeyRef.current !== key) {
          loadedKeyRef.current = key;
          setStripePromise(loadStripe(key));
        }
      })
      .catch((e) => {
        if (!cancelled) setInitError(e instanceof Error ? e.message : "Could not start payment");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  // H-3/C-5: the card was already charged but the order never flipped to paid. Do NOT
  // call confirmCardPayment again (Stripe rejects a succeeded intent) — just finalise
  // against the server so the buyer is never stuck on a paid-but-pending order.
  useEffect(() => {
    if (!alreadyPaid || !clientSecret) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId, payment_intent_id: intentIdFromSecret(clientSecret) }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(err.error?.message || "Payment could not be confirmed");
        }
        if (cancelled) return;
        onPaid({
          ...order,
          status: "paid",
          payment: { ...order.payment, method: "card", paid_at: new Date().toISOString() },
        });
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e.message : "Payment could not be confirmed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadyPaid, clientSecret, onPaid, order, orderId]);

  if (loading) {
    return (
      <section className="section">
        <div className="container-narrow center">
          <p className="small muted row gap-2 center"><Loader2 size={16} className="animate-spin" /> Preparing secure payment…</p>
        </div>
      </section>
    );
  }

  // M-12: a transient failure used to leave nothing but a line of red text — no card,
  // no button, no way forward. Offer a real retry plus an escape route.
  if (initError) {
    return (
      <section className="section">
        <div className="container-narrow center">
          <p className="small" role="alert" style={{ color: "var(--color-ink)", fontWeight: 500 }}>{initError}</p>
          <div className="row gap-2 center mt-4">
            <button className="btn btn-outline" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            <a className="btn btn-outline" href="/orders">View my orders</a>
          </div>
        </div>
      </section>
    );
  }

  if (!publishableKey || !clientSecret || !stripePromise) return null;

  return (
    <Elements stripe={stripePromise}>
      <InnerForm order={order} orderId={orderId} clientSecret={clientSecret} onPaid={onPaid} />
    </Elements>
  );
}
