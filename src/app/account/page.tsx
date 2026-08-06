"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Package, ImagePlus, Wallet } from "lucide-react";
import type { Design } from "@/lib/data";
import { money } from "@/lib/data";
import { DesignCard } from "@/components/DesignCard";

type EarningsSummary = {
  pending_cents: number;
  paid_cents: number;
  total_cents: number;
  pending_count: number;
  paid_count: number;
};

type User = { id: string; email: string; name: string; role: string };

type MineDesign = {
  id: string; slug: string; title: string; price_cents: number;
  seed?: string; palette?: [string, string, string]; shape?: number;
  category?: string; adapters?: string[]; premium_cents?: number;
  ai_generated?: boolean; source?: string; image_url?: string; tags?: string[]; description?: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [myDesigns, setMyDesigns] = useState<Design[]>([]);
  const [designsLoaded, setDesignsLoaded] = useState(false);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch("/api/designs")
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d: { designs?: MineDesign[] }) => {
        const list: Design[] = (d.designs || []).map((m) => ({
          id: m.id,
          slug: m.slug,
          seed: m.seed || m.slug,
          title: m.title,
          creator: user.email.split("@")[0].slice(0, 40),
          category: m.category || "art",
          adapters: m.adapters || ["poster", "tshirt", "sticker"],
          premiumCents: m.premium_cents || 0,
          priceCents: m.price_cents,
          likes: 0, views: 0, sales: 0, rating: 0, reviews: 0,
          aiGenerated: Boolean(m.ai_generated),
          isNew: true,
          tags: m.tags || [],
          created: m.slug,
          palette: m.palette || (["#0c0c0d", "#f7f6f3", "#f7f6f3"] as [string, string, string]),
          shape: m.shape ?? 0,
          imageUrl: m.image_url,
          description: m.description,
        }));
        setMyDesigns(list);
      })
      .catch(() => {})
      .finally(() => setDesignsLoaded(true));
  }, [loaded, user]);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch("/api/earnings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { summary?: EarningsSummary } | null) => setEarnings(d?.summary ?? null))
      .catch(() => {});
  }, [loaded, user]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  };

  if (loaded && !user) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px" }}>
        <h1 className="h2 balance">You&apos;re signed out</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>Sign in to view your account, orders, and generations.</p>
        <Link href="/auth?next=/account" className="btn btn-lg">Sign in <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-narrow">
        <span className="eyebrow eyebrow-dot">Account</span>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>Hi, {user?.name || "there"}</h1>
        <p className="small muted" style={{ marginTop: 6 }}>{user?.email}</p>

        <div className="stack gap-3 mt-8">
          <Link href="/orders" className="card card-hover flex items-center gap-4" style={{ padding: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
            <div className="flex-1">
              <div className="h5">My orders</div>
              <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Track production and deliveries</div>
            </div>
            <ArrowRight size={18} style={{ color: "var(--color-tx-3)" }} />
          </Link>

          <button onClick={signOut} className="card card-hover flex items-center gap-4 text-left" style={{ padding: 20, width: "100%" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={20} />
            </div>
            <div className="flex-1">
              <div className="h5">Sign out</div>
              <div className="tiny" style={{ color: "var(--color-tx-3)" }}>End this session</div>
            </div>
          </button>
        </div>

        {/* Creator earnings */}
        {earnings && (
          <div className="mt-10">
            <div className="row-between mb-5">
              <h2 className="h3 row gap-2"><Wallet size={18} /> Creator earnings</h2>
              <Link href="/payouts" className="link-u small">How payouts work <ArrowRight size={14} /></Link>
            </div>
            <div className="grid g-3" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              <div className="card" style={{ padding: 20 }}>
                <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Pending</div>
                <div className="h3 mono mt-1">{money(earnings.pending_cents)}</div>
                <div className="tiny muted mt-1">{earnings.pending_count} sale{earnings.pending_count === 1 ? "" : "s"} awaiting payout</div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Paid out</div>
                <div className="h3 mono mt-1">{money(earnings.paid_cents)}</div>
                <div className="tiny muted mt-1">{earnings.paid_count} settled</div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Lifetime</div>
                <div className="h3 mono mt-1">{money(earnings.total_cents)}</div>
                <div className="tiny muted mt-1">gross creator earnings</div>
              </div>
            </div>
            <p className="tiny muted mt-3">
              Payouts are settled monthly and sent by manual transfer. Pending earnings become payable once the order ships
              and the return window clears.
            </p>
          </div>
        )}

        {/* My designs */}
        <div className="mt-10">
          <div className="row-between mb-5">
            <h2 className="h3">My designs</h2>
            <Link href="/studio" className="link-u small">New design <ArrowRight size={14} /></Link>
          </div>
          {!designsLoaded ? (
            <p className="small muted">Loading…</p>
          ) : myDesigns.length === 0 ? (
            <div className="card center" style={{ padding: "40px 24px", borderStyle: "dashed" }}>
              <div className="row gap-2 mb-2"><ImagePlus size={18} /> <span className="h5">No designs yet</span></div>
              <p className="small muted">Generate or upload a design in the Studio to publish your first product.</p>
              <Link href="/studio" className="btn btn-outline mt-4">Open Studio</Link>
            </div>
          ) : (
            <div className="grid g-4">
              {myDesigns.map((d) => <DesignCard key={d.id} design={d} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
