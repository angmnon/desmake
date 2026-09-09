"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Star, ChevronRight, Sparkles, BadgeCheck, Truck, ShieldCheck, RotateCcw, ChevronLeft, Check } from "lucide-react";
import type { Design } from "@/lib/data";
import { adapterById, money, unitPriceForSku, variantsForSku, adapterDefaultSku, adapterIdForSku, creatorByHandle, SKU_BY_ID, type SelectedProduct } from "@/lib/data";
import { Artwork } from "@/components/Artwork";
import { DesignCard } from "@/components/DesignCard";
import { ShareSheet } from "@/components/ShareSheet";
import { useCart } from "@/lib/cart";
import { useUser } from "@/lib/use-user";
import { track } from "@/lib/tracking";

function trackEvent(slug: string, event: "view" | "save" | "share") {
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_slug: slug, event }),
    }).catch(() => {});
  } catch {
    /* analytics is best-effort */
  }
}

type RelatedCard = {
  slug: string;
  title: string;
  price_cents: number;
  seed: string;
  palette: [string, string, string];
  shape: number;
  category: string;
  creator: string;
  image_url?: string;
  source?: string;
};

function toDesign(c: RelatedCard): Design {
  return {
    id: c.slug,
    slug: c.slug,
    seed: c.seed || c.slug,
    title: c.title,
    creator: c.creator,
    category: c.category,
    adapters: [],
    premiumCents: 0,
    priceCents: c.price_cents,
    likes: 0,
    views: 0,
    sales: 0,
    rating: 0,
    reviews: 0,
    aiGenerated: c.source === "ai",
    isNew: false,
    tags: [],
    created: "",
    palette: c.palette,
    shape: c.shape ?? 0,
    imageUrl: c.image_url,
    source: c.source === "ai" || c.source === "upload" ? (c.source as "ai" | "upload") : undefined,
    royaltyRate: 0,
    selectedProducts: [],
  };
}

export default function ListingView({ design }: { design: Design }) {
  // M3: 优先用发布时勾选的具体商品（SKU）；旧数据回退到 adapters 推导的 family 默认 SKU。
  const products: SelectedProduct[] =
    design.selectedProducts && design.selectedProducts.length > 0
      ? design.selectedProducts
      : design.adapters
          .map((a) => {
            const s = adapterDefaultSku(a);
            return s ? { sku: s } : undefined;
          })
          .filter((x): x is SelectedProduct => Boolean(x));
  // 强制先选：默认不预选任何商品（此前默认 products[0]=poster → 默认 variant=A3，
  // 导致每一款设计一打开就停在「Poster · A3」，直接加购即得到 A3 海报，造成
  // 「所有产品都变成 A3 明信片」的假象）。买家必须先点选一个商品才能加入购物车。
  const [activeSku, setActiveSku] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [heroError, setHeroError] = useState(false);
  // M-5: brief "Added to bag" confirmation so a click that silently succeeds (and
  // quietly increments qty on an existing line) doesn't read as "nothing happened".
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const creatorData = creatorByHandle(design.creator);
  const creator = useMemo(
    () =>
      creatorData
        ? { name: creatorData.name, handle: creatorData.handle, verified: creatorData.verified }
        : { name: design.creator, handle: design.creator, verified: false },
    [design.creator, creatorData],
  );
  const hasSelection = Boolean(activeSku);
  const adapter = adapterById(adapterIdForSku(activeSku) ?? "");
  const variants = variantsForSku(activeSku);
  const currentVariant = selectedVariant && variants.includes(selectedVariant) ? selectedVariant : variants[0];
  const unit = unitPriceForSku(activeSku, currentVariant);
  const cart = useCart();
  // 未选商品时不允许加购（强制先选）。选中后仍以服务端口径校验 unit 是否为有效价。
  const canBuy = hasSelection && unit !== null && adapter !== undefined;

  // M-UGC: current viewer (for the share/earn affordance) + passive view event.
  const { user } = useUser();
  useEffect(() => {
    trackEvent(design.slug, "view");
    // P0-2: standard view_item event for ad attribution / retargeting.
    track("view_item", {
      currency: "USD",
      value: (design.priceCents || 0) / 100,
      items: [{ item_id: design.slug, item_name: design.title, price: (design.priceCents || 0) / 100 }],
    });
  }, [design.slug]);

  // ── P3: recommendations, streamed in after first paint so they never block LCP ──
  const [recommendations, setRecommendations] = useState<RelatedCard[]>([]);
  const [moreFromCreator, setMoreFromCreator] = useState<RelatedCard[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setRecLoading(true);
    fetch(`/api/listings/${encodeURIComponent(design.slug)}/related?n=8`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setRecommendations(j.recommendations ?? []);
        setMoreFromCreator(j.moreFromCreator ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRecLoading(false); });
    return () => { cancelled = true; };
  }, [design.slug]);

  const addToCart = () => {
    if (unit === null) return;
    cart.addItem({
      listingId: design.id,
      slug: design.slug,
      title: design.title,
      adapter: adapterIdForSku(activeSku) ?? activeSku,
      sku: activeSku,
      variant: currentVariant,
      qty,
      priceCents: unit,
      seed: design.seed,
      palette: design.palette,
      shape: design.shape,
    });
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 2400);
  };

  const renderRecRow = (title: string, items: RelatedCard[], cta?: { href: string; label: string }) => {
    if (items.length === 0) return null;
    return (
      <section className="section section-paper2">
        <div className="container-wide">
          <div className="sec-head">
            <h2 className="h2">{title}</h2>
            {cta && (
              <Link href={cta.href} className="link-u small">
                {cta.label} <ChevronRight size={14} />
              </Link>
            )}
          </div>
          <div className="grid g-4">
            {items.map((c) => (
              <DesignCard key={c.slug} design={toDesign(c)} />
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div>
      <div className="container-wide" style={{ paddingTop: 32, paddingBottom: 16 }}>
        <div className="row gap-2 small mono" style={{ color: "var(--color-tx-3)" }}>
          <Link href="/explore" className="hover:text-ink">Marketplace</Link>
          <ChevronRight size={12} />
          <Link href={`/explore?category=${design.category}`} className="hover:text-ink capitalize">{design.category}</Link>
          <ChevronRight size={12} />
          <span className="text-tx">{design.title}</span>
        </div>
      </div>

      <section>
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(28px,4vw,64px)", paddingBottom: "clamp(48px,6vw,80px)" }}>
          {/* Artwork display */}
          <div className="rv in">
            <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 2 }}>
              <div style={{ aspectRatio: "1", position: "relative" }}>
                {design.imageUrl && !heroError ? (
                  <Image
                    src={design.imageUrl}
                    alt={design.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    decoding="async"
                    onError={() => setHeroError(true)}
                    className="w-full h-full object-cover"
                    style={{ position: "absolute", inset: 0 }}
                  />
                ) : (
                  <Artwork seed={design.seed} palette={design.palette} shape={design.shape} rounded={false} className="!rounded-none" />
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  {design.aiGenerated && (
                    <span className="badge" style={{ background: "rgba(12,12,13,0.75)", color: "#fff", backdropFilter: "blur(8px)" }}>
                      <Sparkles size={11} /> AI Generated
                    </span>
                  )}
                  {!design.aiGenerated && design.imageUrl && (
                    <span className="badge" style={{ background: "rgba(12,12,13,0.75)", color: "#fff", backdropFilter: "blur(8px)" }}>
                      Uploaded
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Thumbnails for adapters — one optimized image, lazy, sized small */}
            <div className="row gap-3 mt-4">
              {design.adapters.map((aid, i) => (
                <button
                  key={aid}
                  onClick={() => { setActiveSku(adapterDefaultSku(aid) ?? activeSku); setSelectedVariant(null); }}
                  className="overflow-hidden"
                  style={{
                    width: 80, height: 80, borderRadius: 14,
                    border: activeSku === adapterDefaultSku(aid) ? "2px solid var(--color-ink)" : "2px solid transparent",
                    padding: 0,
                  }}
                >
                  {design.imageUrl ? (
                    <Image
                      src={design.imageUrl}
                      alt={`${design.title} on ${aid}`}
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      sizes="80px"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <Artwork seed={design.seed + aid} palette={design.palette} shape={(design.shape + i) % 6} rounded={false} className="!rounded-none" />
                  )}
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
                  {creator.verified && <BadgeCheck size={15} style={{ color: "var(--color-ink)" }} />}
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
                <Star size={13} fill="var(--color-ink)" stroke="none" />
                {design.rating} <span className="faint">({design.reviews} reviews)</span>
              </span>
            </div>

            {!hasSelection ? (
              <div className="h2 tnum" style={{ marginBottom: 8 }}>
                Select a product
              </div>
            ) : (
              <div className="h2 tnum" style={{ marginBottom: 8 }}>
                {unit === null ? "Unavailable" : money(unit)}
              </div>
            )}
            {hasSelection && unit !== null && (
              <p className="tiny muted" style={{ marginBottom: 12 }}>
                Excl. tax — calculated at checkout based on your destination.
              </p>
            )}
            {design.royaltyRate ? (
              <p className="tiny mono" style={{ color: "var(--color-ink)", marginBottom: 12 }}>
                Creator earns {Math.round(design.royaltyRate * 100)}% on this design
              </p>
            ) : null}
            <p className="small muted" style={{ marginBottom: 32 }}>
              {adapter
                ? `${adapter.method} · Lead time ${adapter.lead} business days · Produced on demand`
                : "This product option is currently unavailable."}
            </p>

            {/* M3: 具体商品（SKU）选择器 */}
            <div className="mb-6">
              <div className="label">
                Product{!hasSelection && <span style={{ color: "var(--color-ink)", marginLeft: 6 }}>— choose one</span>}
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                {products.map((p) => {
                  const sku = SKU_BY_ID[p.sku];
                  if (!sku) return null;
                  const price = unitPriceForSku(p.sku, variantsForSku(p.sku)[0]);
                  return (
                    <button
                      key={p.sku}
                      onClick={() => { setActiveSku(p.sku); setSelectedVariant(null); }}
                      className="text-left"
                      style={{
                        padding: "12px", border: "1px solid",
                        borderColor: activeSku === p.sku ? "var(--color-ink)" : "rgba(12,12,13,0.12)",
                        borderRadius: 12, background: activeSku === p.sku ? "var(--color-ink)" : "var(--color-surface)",
                        color: activeSku === p.sku ? "var(--color-paper)" : "var(--color-tx)",
                        transition: "all 0.2s",
                      }}
                    >
                      <div className="h5" style={{ fontSize: "0.9rem", lineHeight: 1.3 }}>{sku.name}</div>
                      <div className="tiny mono" style={{ color: activeSku === p.sku ? "rgba(247,246,243,0.6)" : "var(--color-tx-3)", marginTop: 2 }}>
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
                {added ? <><Check size={18} strokeWidth={2} /> Added to bag</> : <><ShoppingBag size={18} strokeWidth={1.8} /> {canBuy ? "Add to cart" : hasSelection ? "Unavailable" : "Select a product"}</>}
              </button>
              <button className="btn btn-outline" style={{ height: 52, width: 52, padding: 0, color: liked ? "var(--color-ink)" : undefined }} aria-label="Save" onClick={() => { setLiked(!liked); trackEvent(design.slug, "save"); }}>
                <Heart size={18} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} />
              </button>
              {user?.handle && (
                <ShareSheet
                  handle={user.handle}
                  designSlug={design.slug}
                  title={design.title}
                  iconOnly
                />
              )}
            </div>

            {added && (
              <p className="tiny" style={{ color: "var(--color-ink)", marginBottom: 24 }}>
                Added to your bag — <Link href="/cart" className="link-u">view cart</Link>
              </p>
            )}

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
                {design.description && <p className="small" style={{ marginBottom: 10 }}>{design.description}</p>}
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

      {/* P3: recommendations — only one row renders if the other is empty */}
      {recLoading ? (
        <section className="section section-paper2">
          <div className="container-wide"><p className="small muted">Finding similar designs…</p></div>
        </section>
      ) : (
        <>
          {renderRecRow("You may also like", recommendations)}
          {renderRecRow(
            "More from this creator",
            moreFromCreator,
            creatorData ? { href: `/creators/${creator.handle}`, label: "View all" } : undefined,
          )}
        </>
      )}

      {/* Back link for small screens */}
      <div className="container-wide pb-10">
        <Link href="/explore" className="link-u small"><ChevronLeft size={14} /> Back to marketplace</Link>
      </div>
    </div>
  );
}
