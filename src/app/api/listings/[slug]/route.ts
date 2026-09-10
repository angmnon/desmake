import { NextResponse } from "next/server";
import { CREATORS, ADAPTERS, ADAPTER_VARIANTS, unitPriceCents, type Design } from "@/lib/data";
import { findListingBySlug, publishedToDesign } from "@/lib/catalog";
import { findPublishedBySlug, relatedFor } from "@/lib/catalogIndex";

// No edge runtime — this route reads the published-designs store on `globalThis` (R2/C1).

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // P0: the authoritative lookup is now an O(1) hit on the cached design index
  // (was a full 5.15 MB D1 scan + JSON.parse on every product view). Falls back to
  // the seed/in-memory catalog if the index cannot be built (D1 disabled).
  let design: Design | undefined;
  try {
    const fresh = await findPublishedBySlug(slug);
    if (fresh) design = publishedToDesign(fresh);
  } catch { /* D1 disabled — fall back below */ }
  if (!design) design = findListingBySlug(slug);
  if (!design) {
    return NextResponse.json({ error: { code: "not_found", message: "Design not found" } }, { status: 404 });
  }
  const creator = CREATORS.find((c) => c.handle === design.creator);
  const adObjs = design.adapters.map((aid) => ADAPTERS.find((a) => a.id === aid)).filter(Boolean);
  // P3: `related` used to be filtered out of the 132 static seeds only, so it was
  // empty for ~97% of the catalogue. Now it is the same content-similarity ranking
  // the detail page uses, computed over every published design.
  const related = (await relatedFor(slug, 4).catch(() => [])).map(publishedToDesign);

  return NextResponse.json({
    data: {
      id: design.id,
      slug: design.slug,
      title: design.title,
      category: design.category,
      tags: design.tags,
      price_cents: design.priceCents,
      ai_generated: design.aiGenerated,
      created: design.created,
      // R2-Low: `stats` removed — these counters are hardcoded 0 in the catalog
      // mapper (no real engagement signal exists), so exposing them claimed
      // fabricated sales/likes/views to API consumers.
      creator: creator ? {
        handle: creator.handle,
        name: creator.name,
        city: creator.city,
        verified: creator.verified,
        followers: creator.followers,
        works: creator.works,
        bio: creator.bio,
      } : { handle: design.creator, name: design.creator, verified: false },
      adapters: adObjs.map((a) => a ? {
        id: a.id, name: a.name, method: a.method, lead_time: a.lead,
        retail_cents: a.retailCents,
        // R2 (found during remediation): this used to return a hand-written variant
        // table that disagreed with the checkout price — it advertised XL at +$2.00
        // (actually +$2.50) and 50×70cm at +$6.00 (actually +$5.00), and gave T-Shirt
        // "L" no upcharge at all. Variants and their prices now come from the same
        // catalog the order endpoint prices against.
        variants: (ADAPTER_VARIANTS[a.id] ?? []).map((v) => ({
          id: v.id,
          label: v.id,
          price_delta: v.deltaCents,
          price_cents: unitPriceCents(design, a.id, v.id),
        })),
      } : null).filter(Boolean),
      seed: design.seed,
      palette: design.palette,
      shape: design.shape,
      image_url: design.imageUrl,
      source: design.source,
      description: design.description,
      // M3: 商品配置与分成
      royalty_rate: design.royaltyRate ?? 0,
      selected_products: (design.selectedProducts ?? []).map((p) => ({ sku: p.sku, variant: p.variant ?? null })),
      license: {
        type: "personal",
        commercial_allowed: true,
        ai_generated: design.aiGenerated,
      },
      related: related.map((r) => ({
        slug: r.slug,
        title: r.title,
        price_cents: r.priceCents,
        seed: r.seed,
        palette: r.palette,
        shape: r.shape,
      })),
    },
  });
}

