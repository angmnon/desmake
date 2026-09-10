"use client";

import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Shield, Truck } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Artwork } from "@/components/Artwork";
import { useEffect, useState } from "react";
import { adapterName, computeOrderTotals, adapterDefaultSku, money } from "@/lib/data";

export default function CartPage() {
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // H-3: this used to call computeTotals() — a legacy estimator that added a flat 8%
  // tax and a $4.99 shipping fee the real pricing engine no longer charges (freight is
  // baked into item prices, so the shipping line is always 0). It made the cart total
  // up to ~81% higher than both the checkout page and the amount actually charged —
  // buyers saw $12.39 here and $6.85 there, which reads as a bait-and-switch and
  // kills trust at the exact moment they decide to buy.
  //
  // Now we use the same computeOrderTotals() the checkout page and the API use. The
  // destination (and therefore VAT) isn't chosen until checkout, so tax is shown as
  // "Calculated at checkout" rather than being invented here.
  const { shippingCents: shipping, totalCents: total } = computeOrderTotals(
    cart.items.map((it) => ({ sku: it.sku || adapterDefaultSku(it.adapter) || "", qty: it.qty, variant: it.variant })),
    "DEFAULT",
  );

  if (!mounted) {
    return (
      <section className="section"><div className="container-wide"><div className="tiny mono">Loading cart…</div></div></section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="section">
        <div className="container-narrow center" style={{ padding: "clamp(48px,8vw,96px) 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <ShoppingBag size={26} strokeWidth={1.5} style={{ color: "var(--color-tx-2)" }} />
          </div>
          <h1 className="h2 balance">Your cart is empty</h1>
          <p className="lead muted" style={{ maxWidth: 360, margin: "12px auto 28px" }}>Browse the marketplace to find AI-generated designs from creators around the world.</p>
          <Link href="/explore" className="btn btn-lg">
            Explore <ArrowRight size={18} strokeWidth={1.8} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(32px,4vw,56px)" }}>
      <div className="container-narrow center">
        <span className="eyebrow eyebrow-dot">Cart</span>
        <h1 className="display balance" style={{ marginTop: 14 }}>Your bag <span className="serif-i">({cart.count})</span></h1>
      </div>

      <div className="container-wide section-sm" style={{ paddingBottom: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 40 }}>
          <div className="stack gap-3">
            {cart.items.map((it, i) => (
              <div key={i} className="card flex gap-4 items-center" style={{ padding: 16 }}>
                <div style={{ width: 92, height: 92, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(12,12,13,0.08)" }}>
                  <Artwork seed={it.seed} palette={it.palette} shape={it.shape} rounded={false} className="!rounded-none" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/listing/${it.slug}`} className="h5 block truncate" style={{ marginBottom: 4 }}>{it.title}</Link>
                  <div className="tiny mono" style={{ color: "var(--color-tx-2)", marginBottom: 8 }}>{adapterName(it.adapter)}{it.variant ? ` / ${it.variant}` : ""}</div>
                  <div className="row gap-2" style={{ fontSize: "0.75rem" }}>
                    <span className="tag"><Truck size={11} /> Ships in 5–7d</span>
                    <span className="tag"><Shield size={11} /> Buyer protection</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="h5 mono">{money(it.priceCents * it.qty)}</div>
                  <div className="row gap-3 items-center">
                    <div className="row items-center" style={{ border: "1px solid rgba(12,12,13,0.12)", borderRadius: 8 }}>
                      <button
                        onClick={() => cart.updateQty(i, it.qty - 1)}
                        className="center" style={{ width: 32, height: 32 }}
                        aria-label="Decrease"
                      >
                        <Minus size={13} strokeWidth={2} />
                      </button>
                      <div className="mono font-semibold" style={{ width: 28, textAlign: "center", fontSize: "0.8125rem" }}>{it.qty}</div>
                      <button
                        onClick={() => cart.updateQty(i, it.qty + 1)}
                        className="center" style={{ width: 32, height: 32 }}
                        aria-label="Increase"
                      >
                        <Plus size={13} strokeWidth={2} />
                      </button>
                    </div>
                    <button onClick={() => cart.removeItem(i)} style={{ width: 32, height: 32, color: "var(--color-tx-3)" }} aria-label="Remove">
                      <Trash2 size={15} strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* M-6: a "Promo code" box used to sit here with no onChange and no onClick —
                a dead control that silently did nothing. Discounts aren't supported by
                the order API, so showing the field only misleads buyers. */}
            <Link href="/explore" className="row gap-2 items-center small" style={{ color: "var(--color-tx-2)" }}>
              Continue browsing designs <ArrowRight size={14} strokeWidth={1.8} />
            </Link>
          </div>

          {/* Summary */}
          <aside className="card" style={{ padding: 24, height: "fit-content", position: "sticky", top: 88 }}>
            <h3 className="h4 mb-4">Order summary</h3>
            <div className="stack gap-2 mb-4">
              {/* cart.subtotal 为【不含税】零售价合计，故 Subtotal + Shipping + Tax = Total 成立。
                  与订单收据页（用含税的 pricing.subtotal_cents）口径不同，勿混用。 */}
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Subtotal</span><span className="mono">{money(cart.subtotal)}</span></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Shipping</span><span className="mono">{shipping === 0 ? "Free" : money(shipping)}</span></div>
              <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Tax</span><span className="mono">At checkout</span></div>
            </div>
            <div className="hr" />
            <div className="row-between mt-4 mb-5">
              <span className="h5">Total</span>
              <span className="h4 mono">{money(total)}</span>
            </div>
            <Link href="/checkout" className="btn btn-lg full center">
              Checkout <ArrowRight size={18} strokeWidth={1.8} />
            </Link>
            <p className="tiny muted center mt-3" style={{ lineHeight: 1.5 }}>
              Shipping is included in item prices. Tax is added at checkout based on your destination (US 7%, EU 19%).
            </p>
            <p className="tiny muted center mt-2">Orders are stored against your session. 30-day returns.</p>
            <div className="row gap-2 mt-4" style={{ justifyContent: "center" }}>
              {["Visa", "MC", "Amex", "Apple Pay", "PayPal"].map((p) => (
                <span key={p} className="tag mono" style={{ fontSize: "0.625rem" }}>{p}</span>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
