import { NextResponse } from "next/server";
import { DESIGNS, CREATORS, ADAPTERS } from "@/lib/data";
import { allPublishedDesigns } from "@/lib/stores";
import { publishedToDesign } from "@/lib/catalog";

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  const tag = (url.searchParams.get("tag") || "").toLowerCase();
  const adapter = url.searchParams.get("adapter") || "";
  const creator = url.searchParams.get("creator") || "";
  const category = url.searchParams.get("category") || "";
  const sort = url.searchParams.get("sort") || "trending";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  // Static seed catalog + Studio-published designs (memory + D1). Reading published
  // designs through D1 keeps the marketplace consistent across all container
  // instances, so freshly batch-published designs show up without a restart.
  let items = DESIGNS.slice();
  try {
    const pub = await allPublishedDesigns();
    items = items.concat(pub.map(publishedToDesign));
  } catch { /* D1 disabled — marketplace shows seed catalog only */ }

  const publishedTags = items.flatMap((d) => d.tags);

  if (q) {
    items = items.filter((d) => d.title.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q)));
  }
  if (tag) {
    items = items.filter((d) => d.tags.some((t) => t.toLowerCase() === tag));
  }
  if (adapter) {
    items = items.filter((d) => d.adapters.includes(adapter));
  }
  if (creator) {
    items = items.filter((d) => d.creator === creator);
  }
  if (category && category !== "all") {
    items = items.filter((d) => d.category === category);
  }

  switch (sort) {
    case "newest":
      items.sort((a, b) => String(b.created).localeCompare(String(a.created)));
      break;
    case "price-low":
      items.sort((a, b) => a.priceCents - b.priceCents);
      break;
    case "price-high":
      items.sort((a, b) => b.priceCents - a.priceCents);
      break;
    case "top":
      items.sort((a, b) => b.sales - a.sales);
      break;
    case "trending":
    default:
      items.sort((a, b) => b.sales * 3 + b.likes - (a.sales * 3 + a.likes));
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  const tags: string[] = Array.from(new Set(publishedTags)).slice(0, 30);

  return NextResponse.json({
    total,
    page,
    total_pages: totalPages,
    per_page: PAGE_SIZE,
    sort,
    filters: { q, tag, adapter, creator, category },
    adapters: ADAPTERS.map((a) => ({ id: a.id, name: a.name })),
    tags,
    items: pageItems.map((d) => {
      const creatorObj = CREATORS.find((c) => c.handle === d.creator);
      return {
        id: d.id,
        slug: d.slug,
        title: d.title,
        category: d.category,
        creator: creatorObj ? { handle: creatorObj.handle, name: creatorObj.name, verified: creatorObj.verified } : { handle: d.creator, name: d.creator },
        adapters: d.adapters,
        price_cents: d.priceCents,
        tags: d.tags,
        stats: { sales: d.sales, likes: d.likes, views: d.views, rating: d.rating, reviews: d.reviews },
        ai_generated: d.aiGenerated,
        is_new: d.isNew,
        created: d.created,
        image_url: d.imageUrl,
        seed: d.seed,
        palette: d.palette,
        shape: d.shape,
      };
    }),
  });
}
