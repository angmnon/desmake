import { NextResponse } from "next/server";
import { publishedPage } from "@/lib/catalogIndex";
import { publishedToDesign } from "@/lib/catalog";
import type { Design } from "@/lib/data";

// Paginated marketplace feed. Reads from the cached design index (one D1 scan per
// process, not per request) and returns a single page — the explore page streams
// the rest via infinite scroll instead of pulling all ~4530 designs at once.
//
// Query params: page, limit(<=60), category, tag, creator, q, sort
// sort: trending | new | price_asc | price_desc
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "24", 10);
  const category = url.searchParams.get("category") || "all";
  const tag = url.searchParams.get("tag") || "";
  const creator = url.searchParams.get("creator") || "";
  const adapter = url.searchParams.get("adapter") || "";
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort") || "trending";

  const res = await publishedPage({ page, limit, category, tag, creator, adapter: adapter || null, q, sort });
  const designs: Design[] = res.items.map(publishedToDesign);

  return NextResponse.json(
    {
      designs,
      total: res.total,
      totalPages: res.totalPages,
      page: res.page,
      limit: res.limit,
      hasMore: res.hasMore,
      counts: res.counts,
    },
    {
      // Short edge cache with stale-while-revalidate. Listings change only when a
      // design is published (which bumps the index version), so a brief cache is safe
      // and never serves empty/error bodies the way the old s-maxage:86400 did.
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
