import { NextResponse } from "next/server";
import { DESIGNS, CREATORS, ADAPTERS, ADAPTER_VARIANTS, unitPriceCents } from "@/lib/data";
import { findListingBySlug } from "@/lib/catalog";

// No edge runtime — this route reads the published-designs store on `globalThis` (R2/C1).

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // R2/H8: designs published from Studio are resolvable here too, otherwise the
  // Publish button would lead to a 404 detail page.
  const design = findListingBySlug(slug);
  if (!design) {
    return NextResponse.json({ error: { code: "not_found", message: "Design not found" } }, { status: 404 });
  }
  const creator = CREATORS.find((c) => c.handle === design.creator);
  const adObjs = design.adapters.map((aid) => ADAPTERS.find((a) => a.id === aid)).filter(Boolean);
  const related = DESIGNS.filter((d) => d.creator === design.creator && d.slug !== slug).slice(0, 4);

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
      stats: { sales: design.sales, likes: design.likes, views: design.views, rating: design.rating, reviews: design.reviews },
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

