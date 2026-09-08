"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { Artwork } from "@/components/Artwork";
import { ArrowRight, Shield } from "lucide-react";
import { ensureSession } from "@/lib/client-session";
import { money, computeOrderTotals, regionFromCountry, adapterDefaultSku, adapterName } from "@/lib/data";
import { track } from "@/lib/tracking";

const STEPS = ["Info", "Review"] as const;

// H-4: the destination was hard-coded to "US", so EU buyers were charged 7% instead
// of 19% VAT (and every international address shipped with a ", US" suffix). The
// buyer must be able to pick the real destination country.
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IS", name: "Iceland" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "CZ", name: "Czechia" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "HR", name: "Croatia" },
  { code: "BG", name: "Bulgaria" },
  { code: "EE", name: "Estonia" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "CY", name: "Cyprus" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong, China" },
  { code: "TW", name: "Taiwan, China" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IL", name: "Israel" },
  { code: "TR", name: "Türkiye" },
];

const EMPTY_FORM = {
  email: "",
  name: "",
  address: "",
  apt: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  phone: "",
};

const FORM_STORAGE_KEY = "dm_checkout_form";

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"info" | "review" | "processing">("info");
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [form, setForm] = useState(EMPTY_FORM);
  const [idemKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `k${Date.now()}${Math.random().toString(16).slice(2)}`,
  );

  // M-1: the cart lives in localStorage, so server-rendered HTML always looks empty.
  // Gate on `mounted` instead of rendering "Your cart is empty" during hydration and
  // flashing it at buyers who do have items.
  useEffect(() => setMounted(true), []);

  // M-1: an unauthenticated buyer is only bounced to /auth at submit time, which
  // destroyed everything they had typed. Persist the form so returning restores it.
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (saved) setForm({ ...EMPTY_FORM, ...(JSON.parse(saved) as typeof EMPTY_FORM) });
    } catch {
      /* ignore */
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form, mounted]);

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
    // is being placed (processing) the cart may be cleared on purpose right before
    // navigating to the payment page — that must NOT trigger a redirect back to
    // /cart (it would race the /checkout/pay navigation).
    if (mounted && cart.items.length === 0 && step !== "processing") {
      router.replace("/cart");
    }
  }, [cart.items.length, step, router, mounted]);

  // P0-2: standard begin_checkout event when the buyer reaches the review step.
  useEffect(() => {
    if (step !== "review") return;
    track("begin_checkout", {
      currency: "USD",
      value: total / 100,
      items: cart.items.map((it) => ({
        item_id: it.slug,
        item_name: it.title,
        price: it.priceCents / 100,
        quantity: it.qty,
      })),
    });
  }, [step, total, cart.items]);

  // H-10: when checkout is blocked on email verification, the buyer needs a way to
  // get another link. Previously the 403 was a dead end with no recovery path.
  const resendVerification = async () => {
    setResendState("sending");
    try {
      const r = await fetch("/api/auth/resend-verification", { method: "POST" });
      setResendState(r.ok ? "sent" : "failed");
    } catch {
      setResendState("failed");
    }
  };

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
        headers: {
          "Content-Type": "application/json",
          // M-9: retrying with the same key replays the first order instead of
          // creating a second one that could also be paid.
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({
          customer: { email: form.email, name: form.name },
          country: form.country,
          // H-6: structured address — the server no longer has to parse one blob, and
          // nothing gets silently truncated out of the shipping label.
          shipping: {
            line1: form.address,
            line2: form.apt,
            city: form.city,
            state: form.state,
            postalCode: form.zip,
            country: form.country,
            phone: form.phone,
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
          error?: { message?: string; code?: string; details?: Array<{ index: number; reason: string }> };
        };
        // M-7: translate the failure into something the buyer can act on instead of
        // raw internals like "line 3: unknown listing_id".
        if (err.error?.code === "email_unverified") {
          setNeedsVerify(true);
          throw new Error("Please confirm your email address to place this order.");
        }
        if (err.error?.code === "unauthorized") {
          router.push("/auth?next=/checkout");
          return;
        }
        const detail = err.error?.details
          ?.map((d) => {
            const item = cart.items[d.index];
            const label = item ? `“${item.title}”` : `item ${d.index + 1}`;
            return `${label}: ${d.reason}`;
          })
          .join("; ");
        throw new Error(
          [detail || err.error?.message || "Order could not be placed", detail ? "Please remove it and try again." : ""]
            .filter(Boolean)
            .join(" "),
        );
      }
      const data = (await res.json()) as { order_id: string; total: number };
      // H-5: the cart is intentionally NOT cleared here any more — only once payment
      // actually succeeds (see /checkout/pay). Clearing now meant a declined card also
      // destroyed the cart, with no way to resume.
      sessionStorage.removeItem(FORM_STORAGE_KEY);
      router.push(`/checkout/pay?order=${data.order_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("review");
    }
  };

  if (!mounted) {
    return (
      <section className="section">
        <div className="container-narrow center" style={{ padding: "clamp(48px,8vw,96px) 24px" }}>
          <p className="small muted">Loading checkout…</p>
        </div>
      </section>
    );
  }

  if (cart.items.length === 0 && step !== "processing") {
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
                    <input required type="email" autoComplete="email" inputMode="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" style={{ borderRadius: 10 }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Full name</label>
                    <input required autoComplete="name" className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Design" style={{ borderRadius: 10 }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Address</label>
                    <input required autoComplete="street-address" className="input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Maker Lane" style={{ borderRadius: 10 }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label small">Apartment, suite, unit <span style={{ color: "var(--color-tx-3)" }}>(optional)</span></label>
                    <input autoComplete="address-line2" className="input mt-1" value={form.apt} onChange={(e) => setForm({ ...form, apt: e.target.value })} placeholder="Apt 4B" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    <label className="label small">City</label>
                    <input required autoComplete="address-level2" className="input mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Brooklyn" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    <label className="label small">State / Province</label>
                    <input autoComplete="address-level1" className="input mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="NY" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    <label className="label small">ZIP / Postal code</label>
                    <input required autoComplete="postal-code" className="input mt-1" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="11201" style={{ borderRadius: 10 }} />
                  </div>
                  <div>
                    {/* H-4: country drives VAT — it must be selectable, not hard-coded. */}
                    <label className="label small">Country</label>
                    <select required autoComplete="country" className="input mt-1" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={{ borderRadius: 10 }}>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    {/* H-6: carriers need a phone number for international delivery. */}
                    <label className="label small">Phone <span style={{ color: "var(--color-tx-3)" }}>(for delivery updates)</span></label>
                    <input autoComplete="tel" inputMode="tel" className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 0100" style={{ borderRadius: 10 }} />
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
                <div className="hr" />
                <div className="stack gap-1 mt-4">
                  <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>Ship to</div>
                  <div className="small">
                    {form.name} · {form.address}{form.apt ? `, ${form.apt}` : ""}
                    <br />
                    {form.city}{form.state ? `, ${form.state}` : ""} {form.zip} · {COUNTRIES.find((c) => c.code === form.country)?.name || form.country}
                    {form.phone ? <><br />{form.phone}</> : null}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="tiny" style={{ color: "var(--color-ink)", lineHeight: 1.6, fontWeight: 500 }}>{error}</div>
            )}

            {needsVerify && (
              <div className="card" style={{ padding: 20 }}>
                <h4 className="h5 mb-2">Confirm your email to continue</h4>
                <p className="small muted" style={{ marginBottom: 14, lineHeight: 1.6 }}>
                  We email a confirmation link when you register. Open it and you can place this order
                  immediately — your cart and details are saved.
                </p>
                <div className="row gap-2 items-center">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={resendVerification}
                    disabled={resendState === "sending"}
                  >
                    {resendState === "sending" ? "Sending…" : "Resend confirmation email"}
                  </button>
                  {resendState === "sent" && (
                    <span className="tiny" style={{ color: "var(--color-ink)" }}>Sent — check your inbox.</span>
                  )}
                  {resendState === "failed" && (
                    <span className="tiny" style={{ color: "var(--color-ink)", fontWeight: 500 }}>Could not send. Please try again shortly.</span>
                  )}
                </div>
              </div>
            )}

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
            {/* M-2: say where the tax comes from. Prices shown in the catalog exclude
                tax, so without this the total looks like it jumped at the last step. */}
            <p className="tiny muted mt-3" style={{ color: "var(--color-tx-3)", lineHeight: 1.5 }}>
              {tax > 0
                ? "Includes tax collected on behalf of the destination country. Shipping is already included in item prices."
                : "Shipping is already included in item prices. No additional tax applies to your destination."}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
