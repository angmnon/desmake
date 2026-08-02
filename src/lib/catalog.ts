// Server-side catalog resolution: the static seed catalog PLUS designs published
// from Studio. Route handlers must use these helpers instead of reaching into
// `DESIGNS` directly, otherwise a published design is browsable but not buyable.
//
// Node runtime only — reads the in-memory store on `globalThis` (R2/C1).

import type { Design } from "@/lib/data";
import { DESIGNS } from "@/lib/data";
import { designsStore, type PublishedDesign } from "@/lib/stores";

export function publishedToDesign(p: PublishedDesign): Design {
  return {
    id: p.id,
    slug: p.slug,
    seed: p.seed,
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
    palette: p.palette,
    shape: p.shape,
  };
}

export function findListingBySlug(slug: string): Design | undefined {
  const seeded = DESIGNS.find((d) => d.slug === slug);
  if (seeded) return seeded;
  const published = designsStore().get(slug);
  return published ? publishedToDesign(published) : undefined;
}

export function findListingById(id: string): Design | undefined {
  const seeded = DESIGNS.find((d) => d.id === id);
  if (seeded) return seeded;
  for (const p of designsStore().values()) {
    if (p.id === id) return publishedToDesign(p);
  }
  return undefined;
}
