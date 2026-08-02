"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Heart, ShoppingBag, Star, ChevronRight, Sparkles, BadgeCheck, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import type { Design } from "@/lib/data";
import { adapterById, designBySlug, designsByCreator, money, unitPriceCents, variantsFor, creatorByHandle } from "@/lib/data";
import { Artwork } from "@/components/Artwork";
import { DesignCard } from "@/components/DesignCard";
import { useCart } from "@/lib/cart";

type ApiListing = {
  data?: {
    id: string; slug: string; title: string; category: string; tags?: string[];
    price_cents: number; ai_generated?: boolean; created?: string;
    creator?: { handle: string };
    adapters?: Array<{ id: string; retail_cents: number }>;
    seed: string; palette: [string, string, string]; shape: number;
  };
};

/**
 * Studio-published designs live in the server store, not in the static seed catalog,
 * so the page falls back to the listings API when the slug is not seeded (R2/H8).
 */
export default function ListingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug as string;
  const seeded = designBySlug(slug);
  const [remote, setRemote] = useState<Design | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    fetch(`/api/listings/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not_found");
        return (await r.json()) as ApiListing;
      })
      .then((json) => {
        const d = json.data;
        if (cancelled || !d) return;
        const baseRetail = d.adapters?.[0]?.retail_cents ?? d.price_cents;
        setRemote({
          id: d.id, slug: d.slug, seed: d.seed, title: d.title,
          creator: d.creator?.handle ?? "unknown", category: d.category,
          adapters: (d.adapters ?? []).map((a) => a.id),
          premiumCents: Math.max(0, d.price_cents - baseRetail),
          priceCents: d.price_cents,
          likes: 0, views: 0, sales: 0, rating: 0, reviews: 0,
          aiGenerated: Boolean(d.ai_generated), isNew: true,
          tags: d.tags ?? [], created: d.created ?? new Date().toISOString(),
          palette: d.palette, shape: d.shape,
        });
      })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [seeded, slug]);

  const design = seeded ?? remote;
  if (missing && !design) notFound();
  if (!design) {
    return (
      <section className="section">
        <div className="container-narrow center"><p className="small muted">Loading design…</p></div>
      </section>
    );
  }
  return <ListingView design={design} />;
}

function ListingView({ design }: { design: Design }) {
  const [activeAdapter, setActiveAdapter] = useState(design.adapters[0] ?? "");
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  const creatorData = creatorByHandle(design.creator);
  const creator = useMemo(
    () =>
      creatorData
        ? { name: creatorData.name, handle: creatorData.handle, verified: creatorData.verified }
        : { name: design.creator, handle: design.creator, verified: false },
    [design.creator, creatorData],
  );
  const adapter = adapterById(activeAdapter);
  // C4/M4/M5: variants + price deltas come from the single ADAPTER_VARIANTS catalog
  // in data.ts — the same table the server uses. No page-local price tables.
  const variants = variantsFor(activeAdapter);
  const currentVariant = selectedVariant && variants.includes(selectedVariant) ? selectedVariant : variants[0];
  // Shared with the API: null means "this adapter/variant combo is not sellable".
  const unit = unitPriceCents(design, activeAdapter, currentVariant);
  const related = designsByCreator(design.creator).filter((d) => d.id !== design.id).slice(0, 4);
  // A Studio-published creator is an email-derived handle with no profile page
  // (/creators is SSG for the seeded catalog). Don't fall back to unrelated
  // designs under "More from this creator", and don't render a dead link.
  const moreFrom = related;

  const cart = useCart();
  const canBuy = unit !== null && adapter !== undefined;
  const addToCart = () => {
    if (unit === null) return;
    cart.addItem({
      listingId: design.id,
      slug: design.slug,
      title: design.title,
      // C4: store the adapter ID, never the display name. The server resolves
      // prices by ID; sending "3D Print" silently fell back to the T-Shirt price.
      adapter: activeAdapter,
      variant: currentVariant,
      qty,
      priceCents: unit,
      seed: design.seed,
      palette: design.palette,
      shape: design.shape,
    });
  };

  return (
    <div>
      <div className="container-wide" style={{ paddingTop: 32, paddingBottom: 16 }}>
        <div className="row gap-2 small mono" style={{ color: "var(--color-tx-3)" }}>
          <Link href="/explore" className="hover:text-ink">Marketplace</Link>
          <ChevronRight size={12} />
          <Link href={`/explore?cat=${design.category}`} className="hover:text-ink capitalize">{design.category}</Link>
          <ChevronRight size={12} />
          <span className="text-tx">{design.title}</span>
        </div>
      </div>

      <section>
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(28px,4vw,64px)", paddingBottom: "clamp(48px,6vw,80px)" }}>
          {/* Artwork display */}
          <div className="rv in">
            <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 22 }}>
              <div style={{ aspectRatio: "1", position: "relative" }}>
                {design.imageUrl ? (
                  <img src={design.imageUrl} alt={design.title} className="w-full h-full object-cover" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
                ) : (
                  <Artwork seed={design.seed} palette={design.palette} shape={design.shape} rounded={false} className="!rounded-none" />
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  {design.aiGenerated && (
                    <span className="badge" style={{ background: "rgba(12,12,13,0.75)", color: "#fff", backdropFilter: "blur(8px)" }}>
                      <Sparkles size={11} /> AI Generated
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Thumbnails for adapters */}
            <div className="row gap-3 mt-4">
              {design.adapters.map((aid, i) => (
                <button
                  key={aid}
                  onClick={() => { setActiveAdapter(aid); setSelectedVariant(null); }}
                  className="overflow-hidden"
                  style={{
                    width: 80, height: 80, borderRadius: 14,
                    border: activeAdapter === aid ? "2px solid var(--color-ink)" : "2px solid transparent",
                    padding: 0,
                  }}
                >
                  <Artwork seed={design.seed + aid} palette={design.palette} shape={(design.shape + i) % 6} rounded={false} className="!rounded-none" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rv in" data-d="1">
            <div className="row gap-2 mb-4">
              {design.tags.slice(0, 3).map((t) => (
                <span key={t} className="chip" style={{ fontSize: "0.75rem", padding: "4px 10px" }}>{t}</span>
              ))}
            </div>
            <h1 className="h1" style={{ marginBottom: 12 }}>{design.title}</h1>

            <div className="row gap-3 mb-5">
              {creatorData ? (
                <Link href={`/creators/${creator.handle}`} className="row gap-2 hover:opacity-80" style={{ padding: "4px 0" }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${design.palette[0]}, ${design.palette[2]})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 600, fontSize: 12,
                    }}
                  >
                    {creator.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="small font-medium">{creator.name}</span>
                  {creator.verified && <BadgeCheck size={15} style={{ color: "var(--color-cobalt)" }} />}
                </Link>
              ) : (
                <div className="row gap-2" style={{ padding: "4px 0" }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${design.palette[0]}, ${design.palette[2]})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 600, fontSize: 12,
                    }}
                  >
                    {creator.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="small font-medium">{creator.name}</span>
                </div>
              )}
              <span className="mono small" style={{ color: "var(--color-tx-3)" }}>·</span>
              <span className="small row gap-1" style={{ color: "var(--color-tx-2)" }}>
                <Star size={13} fill="var(--color-amber)" stroke="none" />
                {design.rating} <span className="faint">({design.reviews} reviews)</span>
              </span>
            </div>

            <div className="h2 tnum" style={{ marginBottom: 8 }}>
              {unit === null ? "Unavailable" : money(unit)}
            </div>
            <p className="small muted" style={{ marginBottom: 32 }}>
              {adapter
                ? `${adapter.method} · Lead time ${adapter.lead} business days · Produced on demand`
                : "This product option is currently unavailable."}
            </p>

            {/* Adapter selector */}
            <div className="mb-6">
              <div className="label">Product type</div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {design.adapters.map((aid) => {
                  const a = adapterById(aid);
                  if (!a) return null;
                  // Show the real all-in price for that adapter (base + design premium),
                  // so the tile matches the headline price instead of the bare base cost.
                  const price = unitPriceCents(design, aid, variantsFor(aid)[0]);
                  return (
                    <button
                      key={aid}
                      onClick={() => { setActiveAdapter(aid); setSelectedVariant(null); }}
                      className="text-left"
                      style={{
                        padding: "12px", border: "1px solid",
                        borderColor: activeAdapter === aid ? "var(--color-ink)" : "rgba(12,12,13,0.12)",
                        borderRadius: 12, background: activeAdapter === aid ? "var(--color-ink)" : "var(--color-surface)",
                        color: activeAdapter === aid ? "var(--color-paper)" : "var(--color-tx)",
                        transition: "all 0.2s",
                      }}
                    >
                      <div className="h5">{a.name}</div>
                      <div className="tiny mono" style={{ color: activeAdapter === aid ? "rgba(247,246,243,0.6)" : "var(--color-tx-3)", marginTop: 2 }}>
                        {price === null ? "—" : money(price)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Variants */}
            <div className="mb-6">
              <div className="label">Variant</div>
              <div className="row gap-2 wrap">
                {variants.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSelectedVariant(v)}
                    className="chip"
                    style={{
                      borderColor: currentVariant === v ? "var(--color-ink)" : "rgba(12,12,13,0.15)",
                      background: currentVariant === v ? "var(--color-ink)" : "var(--color-surface)",
                      color: currentVariant === v ? "var(--color-paper)" : "var(--color-tx)",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty + Add to cart */}
            <div className="row gap-3 mb-6">
              <div className="row" style={{ border: "1px solid rgba(12,12,13,0.15)", borderRadius: 12, height: 52 }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 h-full font-medium" style={{ fontSize: 18 }}>−</button>
                <span className="px-4 tnum font-medium">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-4 h-full font-medium" style={{ fontSize: 18 }}>+</button>
              </div>
              <button
                className="btn btn-lg flex-1"
                style={{ height: 52, opacity: canBuy ? 1 : 0.5, cursor: canBuy ? undefined : "not-allowed" }}
                onClick={addToCart}
                disabled={!canBuy}
              >
                <ShoppingBag size={18} strokeWidth={1.8} /> {canBuy ? "Add to cart" : "Unavailable"}
              </button>
              <button className="btn btn-outline" style={{ height: 52, width: 52, padding: 0, color: liked ? "var(--color-signal)" : undefined }} aria-label="Save" onClick={() => setLiked(!liked)}>
                <Heart size={18} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid g-3 small" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", marginBottom: 32 }}>
              {[
                { icon: <Truck size={16} strokeWidth={1.8} />, t: "Global shipping" },
                { icon: <ShieldCheck size={16} strokeWidth={1.8} />, t: "Quality checked" },
                { icon: <RotateCcw size={16} strokeWidth={1.8} />, t: "30-day returns" },
              ].map((b) => (
                <div key={b.t} className="row gap-2" style={{ color: "var(--color-tx-2)" }}>
                  {b.icon}<span>{b.t}</span>
                </div>
              ))}
            </div>

            <hr className="hr mb-6" />

            <div className="stack gap-4">
              <div>
                <div className="label">About this design</div>
                <p className="small muted">
                  Generated/designed by {creator.name}. Each unit is produced on demand when you order — no inventory, no waste. Our manufacturing partners in 14 regions route your order to the closest facility with available capacity.
                </p>
              </div>
              <div>
                <div className="label">Print method</div>
                <p className="small muted">
                  {adapter ? `${adapter.method}. ` : ""}Printed on premium materials, inspected by hand before shipping.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* More from */}
      {moreFrom.length > 0 && (
        <section className="section section-paper2">
          <div className="container-wide">
            <div className="sec-head">
              <h2 className="h2">More from this creator</h2>
              {creatorData && (
                <Link href={`/creators/${creator.handle}`} className="link-u small">View all <ChevronRight size={14} /></Link>
              )}
            </div>
            <div className="grid g-4">
              {moreFrom.map((d) => <DesignCard key={d.id} design={d} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
