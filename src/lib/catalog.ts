// Server-side catalog resolution: the static seed catalog PLUS designs published
// from Studio. Route handlers must use these helpers instead of reaching into
// `DESIGNS` directly, otherwise a published design is browsable but not buyable.
//
// Node runtime only — reads the in-memory store on `globalThis` (R2/C1).

import type { Design, SelectedProduct } from "@/lib/data";
import { DESIGNS, adapterDefaultSku } from "@/lib/data";
import { designsStore, allPublishedDesigns, type PublishedDesign } from "@/lib/stores";

/**
 * M3: 该设计实际可售的商品列表。
 * 优先用发布时勾选的 selectedProducts；旧数据（仅含 adapters）按其 family 默认 SKU 推导，
 * 保证已发布的 88 个设计在 UI 仍正常可售。
 */
export function productsOf(p: PublishedDesign): SelectedProduct[] {
  if (p.selectedProducts && p.selectedProducts.length > 0) return p.selectedProducts;
  const derived = p.adapters
    .map((a) => {
      const sku = adapterDefaultSku(a);
      return sku ? { sku } : undefined;
    })
    .filter((x): x is SelectedProduct => Boolean(x));
  return derived;
}

/** M3: 该设计的分成比例；仅在 [0.1,0.5] 内有效，否则视为未配置（0，不产生分成）。 */
export function royaltyRateOf(p: PublishedDesign): number {
  const r = p.royaltyRate;
  return r && r >= 0.1 && r <= 0.5 ? r : 0;
}

export function publishedToDesign(p: PublishedDesign): Design {
  // The static `Design` type requires seed/palette/shape (it always has them),
  // but an uploaded design may omit them — fall back so the listing/card render
  // cleanly (the real image in `imageUrl` is what actually shows).
  return {
    id: p.id,
    slug: p.slug,
    seed: p.seed || p.slug,
    title: p.title,
    creator: p.creator,
    category: p.category,
    adapters: p.adapters,
    premiumCents: p.premiumCents,
    priceCents: p.priceCents,
    likes: 0,
    views: 0,
    sales: 0,
    rating: 0,
    reviews: 0,
    aiGenerated: p.aiGenerated,
    isNew: true,
    tags: p.tags,
    created: p.created_at,
    palette: p.palette || (["#0c0c0d", "#f7f6f3", "#f7f6f3"] as [string, string, string]),
    shape: p.shape ?? 0,
    imageUrl: p.imageUrl,
    description: p.description,
    source: p.source,
    royaltyRate: royaltyRateOf(p),
    selectedProducts: productsOf(p),
  };
}

export function findListingBySlug(slug: string): Design | undefined {
  const seeded = DESIGNS.find((d) => d.slug === slug);
  if (seeded) return seeded;
  const published = designsStore().get(slug);
  return published ? publishedToDesign(published) : undefined;
}

export function findListingById(id: string): Design | undefined {
  const seeded = DESIGNS.find((d) => d.id === id || d.slug === id);
  if (seeded) return seeded;
  for (const p of designsStore().values()) {
    if (p.id === id || p.slug === id) return publishedToDesign(p);
  }
  return undefined;
}

/**
 * 跨实例安全版：内存未命中时回落 D1（权威）。
 * 容器 max_instances=3 —— 某实例启动之后才发布的设计不在它的内存 Map 里，
 * 只用同步版会导致「设计详情能看，但下单报 unknown listing_id」。
 */
export async function findListingByIdAsync(id: string): Promise<Design | undefined> {
  const local = findListingById(id);
  if (local) return local;
  const fresh = (await allPublishedDesigns()).find((p) => p.id === id || p.slug === id);
  return fresh ? publishedToDesign(fresh) : undefined;
}
