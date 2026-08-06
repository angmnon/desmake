"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Check, Package } from "lucide-react";
import { ORDER_STATES, money, adapterName } from "@/lib/data";

const TONE: Record<string, string> = {
  moss: "badge-moss",
  cobalt: "badge-cobalt",
  amber: "badge-amber",
  violet: "badge-violet",
  signal: "badge-signal",
};
const stateLabel = (id: string) => ORDER_STATES.find((s) => s.id === id)?.label || id;
const stateTone = (id: string) => TONE[ORDER_STATES.find((s) => s.id === id)?.tone || "signal"] || "badge-outline";

type OrderItem = {
  listing_id: string;
  title?: string;
  adapter: string;
  variant?: string;
  quantity: number;
  unit_price_cents: number;
};

type OrderDetail = {
  order_id: string;
  created_at: string;
  items: OrderItem[];
  pricing: { subtotal_cents: number; tax_cents: number; shipping_cents: number; total_cents: number };
  shipping?: { address?: string | null; method?: string };
  manufacturing: { status: string; facility_id?: string | null; tracking?: string | null };
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "404">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${id}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          // M3: redirect from the effect, not during render.
          router.replace(`/auth?next=/orders/${id}`);
          return;
        }
        if (!r.ok) { setStatus("404"); return; }
        const d = (await r.json()) as OrderDetail;
        if (cancelled) return;
        setData(d);
        setStatus("ok");
      })
      .catch(() => { if (!cancelled) setStatus("404"); });
    return () => { cancelled = true; };
  }, [id, router]);

  if (status === "loading") return <section className="section"><div className="container-narrow center"><p className="small muted">Loading…</p></div></section>;

  if (status === "404" || !data) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px" }}>
        <h1 className="h2 balance">Order not found</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>We couldn&apos;t find an order with this ID.</p>
        <Link href="/orders" className="btn btn-lg">View my orders <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  const currentIdx = ORDER_STATES.findIndex((s) => s.id === data.manufacturing.status);
  const p = data.pricing;

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-wide">
        <nav className="row gap-1 tiny mono mb-4"><Link href="/orders" style={{ color: "var(--color-tx-3)" }}>Orders</Link><span style={{ color: "var(--color-tx-3)" }}>/</span><span className="text-tx">{data.order_id}</span></nav>

        <div className="row-between wrap gap-4 mb-6">
          <div>
            <h1 className="h1 balance">Order {data.order_id}</h1>
            <p className="small muted" style={{ marginTop: 4 }}>Placed {new Date(data.created_at).toLocaleString()}</p>
          </div>
          <span className={`badge ${stateTone(data.manufacturing.status)}`}>{stateLabel(data.manufacturing.status)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 32 }}>
          {/* Items + timeline */}
          <div className="stack gap-5">
            <div className="card" style={{ padding: 22 }}>
              <h3 className="h4 mb-4">Items</h3>
              <div className="stack gap-3">
                {data.items.map((it, i) => (
                  <div key={i} className="row gap-3 items-center" style={{ borderBottom: i < data.items.length - 1 ? "1px solid rgba(12,12,13,0.08)" : "none", paddingBottom: i < data.items.length - 1 ? 12 : 0 }}>
                    <div className="flex-1 min-w-0">
                      <div className="small font-semibold truncate">{it.title || it.listing_id}</div>
                      <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{adapterName(it.adapter)}{it.variant ? ` · ${it.variant}` : ""} × {it.quantity}</div>
                    </div>
                    <div className="small mono">{money(it.unit_price_cents * it.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <h3 className="h4 mb-4">Manufacturing</h3>
              <div className="stack gap-0">
                {ORDER_STATES.map((s, i) => {
                  const done = i <= currentIdx;
                  const now = i === currentIdx;
                  return (
                    <div key={s.id} className="row gap-3" style={{ padding: "10px 0", opacity: done ? 1 : 0.4 }}>
                      <div className="center" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: done ? "var(--color-moss)" : "var(--color-paper-2)", color: done ? "#fff" : "var(--color-tx-3)" }}>
                        {done ? <Check size={14} strokeWidth={3} /> : <span className="tiny mono">{i + 1}</span>}
                      </div>
                      <div className="flex-1">
                        <div className="small font-medium" style={{ color: now ? "var(--color-ink)" : "var(--color-tx)" }}>{s.label}{now ? " — in progress" : ""}</div>
                        {s.id === "shipped" && data.manufacturing.tracking && (
                          <div className="tiny mono" style={{ color: "var(--color-tx-3)", marginTop: 2 }}>{data.manufacturing.tracking}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary + shipping */}
          <aside className="stack gap-4">
            <div className="card" style={{ padding: 22 }}>
              <h4 className="h5 mb-3">Summary</h4>
              <div className="stack gap-2">
                {/* pricing.subtotal_cents 是【含税】售价合计（computeOrderTotals 里的
                    saleSubtotal），而 tax_cents 是其中所含的税。之前收据把两者当成独立加项
                    并列，导致 Subtotal + Tax + Shipping 比 Total 多出一个税额，买家会以为
                    被重复计税。这里减回不含税小计，让三行相加正好等于 Total —— 与购物车/
                    结账页（那两处的 cart.subtotal 本来就是不含税口径）保持一致。 */}
                <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Subtotal</span><span className="mono">{money(p.subtotal_cents - p.tax_cents)}</span></div>
                <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Shipping</span><span className="mono">{p.shipping_cents === 0 ? "Free" : money(p.shipping_cents)}</span></div>
                <div className="row-between small"><span style={{ color: "var(--color-tx-2)" }}>Tax</span><span className="mono">{money(p.tax_cents)}</span></div>
              </div>
              <div className="hr" style={{ margin: "14px 0" }} />
              <div className="row-between"><span className="h5">Total</span><span className="h4 mono">{money(p.total_cents)}</span></div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <h4 className="h5 mb-3">Shipping</h4>
              <div className="tiny" style={{ color: "var(--color-tx-2)", whiteSpace: "pre-line" }}>{data.shipping?.address || "No address provided"}</div>
              {data.manufacturing.facility_id && (
                <div className="row gap-2 tiny muted mt-3"><Package size={13} /> {data.manufacturing.facility_id}</div>
              )}
            </div>

            <Link href="/orders" className="btn btn-outline full center">All orders <ArrowRight size={16} strokeWidth={1.8} /></Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
