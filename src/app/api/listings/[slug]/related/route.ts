import { NextResponse } from "next/server";
import { findPublishedBySlug, relatedFor, publishedPage } from "@/lib/catalogIndex";
import { publishedToDesign } from "@/lib/catalog";
import type { Design } from "@/lib/data";

// Content-based "You may also like" + "More from this creator" for a product page.
// All reads go through the cached design index (no per-request D1 scan). Streamed in
// by the client after the detail page paints, so it never blocks LCP.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const n = Math.min(Math.max(parseInt(url.searchParams.get("n") || "8", 10) || 8, 1), 16);

  const base = await findPublishedBySlug(slug);
  if (!base) {
    return NextResponse.json({ error: { code: "not_found", message: "Design not found" } }, { status: 404 });
  }

  // Over-fetch similar items, because the similarity score gives same-creator work a
  // large bonus — without this the two rows would show mostly the same products.
  const [recsRaw, moreRes] = await Promise.all([
    relatedFor(slug, n * 5),
    publishedPage({ creator: base.creator, excludeSlug: slug, limit: n }),
  ]);

  const creatorSlugs = new Set(moreRes.items.map((d) => d.slug));
  let recs = recsRaw.filter((d) => !creatorSlugs.has(d.slug)).slice(0, n);
  // Tiny catalogue / single-design creator: fall back to the unfiltered ranking so
  // the row is never empty just because of dedupe.
  if (recs.length === 0) recs = recsRaw.slice(0, n);

  const toCard = (d: Design) => ({
    slug: d.slug,
    title: d.title,
    price_cents: d.priceCents,
    seed: d.seed,
    palette: d.palette,
    shape: d.shape,
    category: d.category,
    creator: d.creator,
    image_url: d.imageUrl,
    source: d.source,
  });

  return NextResponse.json(
    {
      recommendations: recs.map(publishedToDesign).map(toCard),
      moreFromCreator: moreRes.items.map(publishedToDesign).map(toCard),
    },
    {
      headers: {
        // Short edge cache: recommendations change only when the catalogue changes.
        // Deliberately short + SWR so a bad response can never be pinned for a day.
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
