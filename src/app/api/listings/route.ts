import { NextResponse } from "next/server";
import { CREATORS, ADAPTERS } from "@/lib/data";
import { publishedPage, catalogTags } from "@/lib/catalogIndex";
import { publishedToDesign } from "@/lib/catalog";

const PAGE_SIZE = 24;

// Sort keys this public API has always accepted, mapped onto the index's vocabulary.
// "top" has no real signal yet (sales/likes are hardcoded 0 in the catalog mapper),
// so it degrades to the recency-based trending order instead of a random-looking list.
const SORT_MAP: Record<string, string> = {
  newest: "newest",
  "price-low": "price_asc",
  "price-high": "price_desc",
  top: "trending",
  trending: "trending",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  const tag = (url.searchParams.get("tag") || "").toLowerCase();
  const adapter = url.searchParams.get("adapter") || "";
  const creator = url.searchParams.get("creator") || "";
  const category = url.searchParams.get("category") || "";
  const sort = url.searchParams.get("sort") || "trending";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  // P0: filtering/sorting/pagination now runs against the cached in-memory design
  // index (seed catalog + every Studio-published design). Previously this route
  // rebuilt the whole 4.5k-item array from a full D1 scan on every request.
  const [res, tags] = await Promise.all([
    publishedPage({
      page,
      limit: PAGE_SIZE,
      q: q || undefined,
      tag: tag || undefined,
      adapter: adapter || undefined,
      creator: creator || undefined,
      category: category || undefined,
      sort: SORT_MAP[sort] ?? "trending",
    }),
    catalogTags(30),
  ]);

  return NextResponse.json(
    {
      total: res.total,
      page: res.page,
      total_pages: res.totalPages,
      per_page: res.limit,
      sort,
      filters: { q, tag, adapter, creator, category },
      adapters: ADAPTERS.map((a) => ({ id: a.id, name: a.name })),
      tags,
      items: res.items.map(publishedToDesign).map((d) => {
        const creatorObj = CREATORS.find((c) => c.handle === d.creator);
        return {
          id: d.id,
          slug: d.slug,
          title: d.title,
          category: d.category,
          creator: creatorObj
            ? { handle: creatorObj.handle, name: creatorObj.name, verified: creatorObj.verified }
            : { handle: d.creator, name: d.creator },
          adapters: d.adapters,
          price_cents: d.priceCents,
          tags: d.tags,
          // R2-Low: the `stats` block was removed. sales/likes/views/rating/reviews
          // are hardcoded 0 in the catalog mapper (no real signal exists yet), so
          // publishing them advertised fabricated engagement metrics to API clients.
          ai_generated: d.aiGenerated,
          is_new: d.isNew,
          created: d.created,
          image_url: d.imageUrl,
          seed: d.seed,
          palette: d.palette,
          shape: d.shape,
        };
      }),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
