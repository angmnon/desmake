"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Package } from "lucide-react";
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

type ApiItem = { title?: string; adapter?: string; variant?: string; quantity?: number };
type ApiOrder = { order_id: string; status: string; total_cents: number; items?: ApiItem[]; created_at?: string };

type Row = {
  id: string;
  date?: string;
  state: string;
  totalCents: number;
  items: { title: string; adapter: string; variant?: string; quantity: number }[];
};

export default function OrdersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then(async (r) => {
        if (r.status === 401) {
          // M3: navigate from an effect, never during render.
          router.replace("/auth?next=/orders");
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { orders?: ApiOrder[] };
      })
      .then((d) => {
        if (cancelled || !d) return;
        // H5: only real orders belonging to this session are rendered. The old
        // page fell back to a hard-coded ORDERS seed array, so a brand-new user
        // saw three "shipped" orders that did not exist and whose detail pages 404'd.
        const live: Row[] = (d.orders ?? []).map((o) => ({
          id: o.order_id,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString() : undefined,
          state: o.status,
          totalCents: o.total_cents ?? 0,
          items: (o.items ?? []).map((it) => ({
            title: it.title ?? "Design",
            adapter: it.adapter ?? "",
            variant: it.variant,
            quantity: it.quantity ?? 1,
          })),
        }));
        setRows(live);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load your orders. Please try again.");
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-wide">
        <div className="sec-head">
          <div>
            <span className="eyebrow eyebrow-dot">Orders</span>
            <h1 className="h1 balance" style={{ marginTop: 12 }}>Your orders</h1>
          </div>
          <Link href="/explore" className="btn btn-outline">Shop more <ArrowRight size={16} strokeWidth={1.8} /></Link>
        </div>

        {rows === null && (
          <div className="stack gap-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ padding: 22 }}>
                <div className="skeleton" style={{ height: 18, width: "40%", borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 14, width: "65%", borderRadius: 6, marginTop: 12 }} />
              </div>
            ))}
          </div>
        )}

        {error && <p className="small" style={{ color: "var(--color-signal)" }}>{error}</p>}

        {rows !== null && rows.length === 0 && !error && (
          <div className="card center" style={{ padding: "clamp(40px,6vw,72px)" }}>
            <Package size={32} style={{ color: "var(--color-tx-3)" }} />
            <h3 className="h3 mt-3">No orders yet</h3>
            <p className="small muted" style={{ margin: "8px 0 20px" }}>When you place an order it will show up here.</p>
            <Link href="/explore" className="btn btn-lg">Explore the marketplace</Link>
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="stack gap-4">
            {rows.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="card card-hover" style={{ padding: 22, display: "block" }}>
                <div className="row-between wrap gap-3 mb-3">
                  <div className="row gap-3">
                    <span className="mono small" style={{ fontWeight: 600 }}>{o.id}</span>
                    <span className={`badge ${stateTone(o.state)}`}>{stateLabel(o.state)}</span>
                    {o.date && <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{o.date}</span>}
                  </div>
                  <span className="h5 mono">{money(o.totalCents)}</span>
                </div>
                <div className="row gap-3 wrap">
                  {o.items.map((it, i) => (
                    <span key={i} className="tiny mono" style={{ padding: "3px 9px", border: "1px solid rgba(12,12,13,0.1)", borderRadius: 6, color: "var(--color-tx-3)" }}>
                      {it.title} · {adapterName(it.adapter)}{it.variant ? ` · ${it.variant}` : ""} × {it.quantity}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
