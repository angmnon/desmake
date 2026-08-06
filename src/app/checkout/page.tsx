"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { Artwork } from "@/components/Artwork";
import { ArrowRight, Shield } from "lucide-react";
import { ensureSession } from "@/lib/client-session";
import { money, computeOrderTotals, regionFromCountry, adapterDefaultSku, adapterName } from "@/lib/data";

const STEPS = ["Info", "Review"] as const;

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [step, setStep] = useState<"info" | "review" | "processing">("info");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    address: "",
    city: "",
    zip: "",
    country: "US",
  });

  // Single pricing source of truth: call the SAME computeOrderTotals() the API uses,
  // rather than re-deriving shipping/tax here (a copy that silently drifts is how
  // the displayed total stopped matching the charged total).
  const region = regionFromCountry(form.country);
  const totals = computeOrderTotals(
    cart.items.map((it) => ({ sku: it.sku || adapterDefaultSku(it.adapter) || "", qty: it.qty, variant: it.variant })),
    region,
  );
  const { shippingCents: shipping, taxCents: tax, totalCents: total } = totals;

  useEffect(() => {
    // Only bounce empty-cart visitors away during the normal flow. While an order
    // is being placed (processing) the cart is cleared on purpose right before
    // navigating to the payment page — that must NOT trigger a redirect back to
    // /cart (it would race the /checkout/pay navigation).
    if (cart.items.length === 0 && step !== "processing") {
      router.replace("/cart");
    }
  }, [cart.items.length, step, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "info") {
      setStep("review");
      return;
    }
    setStep("processing");
    setError(null);
    try {
      // C6: order creation requires a logged-in account.
      const authed = await ensureSession();
      if (!authed) {
        router.push("/auth?next=/checkout");
        return;
      }

      // C1: create the order against the API. The server derives the authoritative
      // price — the client never sends money amounts. The order is created
      // PENDING payment and the buyer is sent to the payment page.
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { email: form.email, name: form.name },
          country: form.country,
          region,
          shipping: {
            address: `${form.address}, ${form.city} ${form.zip}, ${form.country}`,
            method: "standard",
          },
          items: cart.items.map((it) => ({
            listing_id: it.listingId,
            adapter: it.adapter,
            sku: it.sku || adapterDefaultSku(it.adapter) || "",
            variant: it.variant,
            quantity: it.qty,
          })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { message?: string; details?: Array<{ index: number; reason: string }> };
        };
        // The API rejects the WHOLE order when any line is unsellable; surface which one.
        const detail = err.error?.details?.map((d) => `line ${d.index + 1}: ${d.reason}`).join("; ");
        throw new Error([err.error?.message || "Order could not be placed", detail].filter(Boolean).join(" — "));
      }
      const data = (await res.json()) as { order_id: string; total: number };
      cart.clear();
      // Off to the payment page — the order is pending until payment is confirmed.
      router.push(`/checkout/pay?order=${data.order_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("review");
    }
  };

  if (cart.items.length === 0) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,8vw,96px) 24px" }}>
        <h1 className="h2 balance">Your cart is empty</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>Add something from the marketplace to check out.</p>
        <Link href="/explore" className="btn btn-lg">Explore <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(32px,4vw,56px)" }}>
      <div className="container-narrow center">
        <nav className="row gap-1 tiny mono mb-4" style={{ justifyContent: "center" }}>
          <Link href="/cart" style={{ color: "var(--color-tx-3)" }}>Cart</Link>
          <span style={{ color: "var(--color-tx-3)" }}>/</span>
          <span style={{ color: "var(--color-tx)" }}>Checkout</span>
        </nav>
        <h1 className="h1 balance center mono">Checkout</h1>
        <div className="row gap-2 mt-4" style={{ justifyContent: "center" }}>
          {STEPS.map((s, i) => (
            <div key={s} className="row gap-2 items-center">
              <div className="center" style={{
                width: 24, height: 24, borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600,
                background: (step === "info" && i === 0) || (step === "review" && i <= 1) ? "var(--color-ink)" : "rgba(12,12,13,0.1)",
                color: (step === "info" && i === 0) || (step === "review" && i <= 1) ? "#fff" : "var(--color-tx-3)",
              }}>{i + 1}</div>
              <span className="small" style={{ color: "var(--color-tx-2)" }}>{s}</span>
              {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, background: "rgba(12,12,13,0.1)" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="container-wide section-sm" style={{ paddingBottom: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 40 }}>
          <form onSubmit={submit} className="stack gap-4">
            {step === "info" && (
              <div className="card" style={{ padding: 24 }}>
                <h3 className="h4 mb-4">Shipping information</h3>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Email</label>
                    <input required type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" style={{ borderRadius: 10 }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Full name</label>
                    <input required className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Design" style={{ borderRadius: 10 }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Address</label>
                    <input required className="input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Maker Lane" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    <label className="label small">City</label>
                    <input required className="input mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Brooklyn" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    <label className="label small">ZIP</label>
                    <input required className="input mt-1" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="11201" style={{ borderRadius: 10 }} />
                  </div>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="card" style={{ padding: 24 }}>
                <div className="row-between mb-4">
                  <h3 className="h4">Review & place order</h3>
                  <span className="tag mono"><Shield size={11} /> Secure checkout</span>
                </div>
                <p className="small muted" style={{ marginBottom: 16 }}>
                  Your order is created now and you&apos;ll continue to a payment step. The total is computed server-side — you are never asked to enter a price.
                </p>
                <div className="stack gap-3">
                  {cart.items.map((it, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(12,12,13,0.08)" }}>
                        <Artwork seed={it.seed} palette={it.palette} shape={it.shape} rounded={false} className="!rounded-none" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="small font-semibold truncate">{it.title}</div>
                        <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{adapterName(it.adapter)} · {it.variant} × {it.qty}</div>
                      </div>
                      <div className="small mono">{money(it.priceCents * it.qty)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="tiny" style={{ color: "var(--color-signal)" }}>{error}</div>}

            <button type="submit" className="btn btn-lg full center" disabled={step === "processing"}>
              {step === "processing" ? "Processing…" : step === "info" ? <>Continue to review <ArrowRight size={18} strokeWidth={1.8} /></> : <>Place order · {money(total)}</>}
            </button>
            <p className="tiny muted center" style={{ color: "var(--color-tx-3)" }}>
              <Shield size={11} style={{ display: "inline", verticalAlign: -1 }} /> Orders are stored server-side and tied to your session. Buyer protection included.
            </p>
          </form>

          <aside className="card" style={{ padding: 24, height: "fit-content", position: "sticky", top: 88 }}>
            <h4 className="h5 mb-3">Your order</h4>
            <div className="stack gap-3 mb-4" style={{ maxHeight: 320, overflowY: "auto" }}>
              {cart.items.map((it, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(12,12,13,0.08)" }}>
                    <Artwork seed={it.seed} palette={it.palette} shape={it.shape} rounded={false} className="!rounded-none" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="small font-semibold truncate">{it.title}</div>
                    <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{adapterName(it.adapter)} · {it.variant} × {it.qty}</div>
                  </div>
                  <div className="small mono">{money(it.priceCents * it.qty)}</div>
                </div>
              ))}
            </div>
            <div className="hr" />
            <div className="stack gap-2 mt-4">
              {/* 注意口径：这里的 cart.subtotal 是【不含税】零售价合计（购物车行单价来自
                  详情页展示价），因此 Subtotal + Shipping + Tax = Total 是成立的。
                  不要照搬 order.pricing.subtotal_cents 的口径——那个是【含税】售价。 */}
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Subtotal</span><span className="mono">{money(cart.subtotal)}</span></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Shipping</span><span className="mono">{shipping === 0 ? "Free" : money(shipping)}</span></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Tax</span><span className="mono">{money(tax)}</span></div>
            </div>
            <div className="hr" />
            <div className="row-between mt-3">
              <span className="h5">Total</span>
              <span className="h4 mono">{money(total)}</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
