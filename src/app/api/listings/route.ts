import { NextResponse } from "next/server";
import { DESIGNS, CREATORS, ADAPTERS } from "@/lib/data";

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

  let items = DESIGNS.slice();

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
      items.reverse();
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

  const tags: string[] = Array.from(new Set(DESIGNS.flatMap((d) => d.tags))).slice(0, 30);

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
        seed: d.seed,
        palette: d.palette,
        shape: d.shape,
      };
    }),
  });
}
