import { publishedPage } from "@/lib/catalogIndex";
import { publishedToDesign } from "@/lib/catalog";
import type { Design } from "@/lib/data";
import ExploreClient from "./ExploreClient";

// Reads searchParams (category / q / sort) and renders the first page on the server,
// so the marketplace grid is in the initial HTML (good LCP + SEO) and the client only
// streams subsequent pages via infinite scroll.
//
// P1-2: previously `force-dynamic` (every request hit the origin container, worst-case
// TTFB, no edge cache). Now ISR with `revalidate = 600` — Cloudflare's edge serves
// cached HTML for up to 10 min with stale-while-revalidate, so browse traffic gets a
// fast TTFB. Freshness is preserved two ways: (1) the catalog data read goes through
// the shared-version index (D1-backed, fresh within ~1s of a publish), and (2) a
// publish calls `revalidatePath('/explore')` so the cached shell is regenerated.
// On Cloudflare Workers, OpenNext wires `revalidatePath`/`revalidateTag` through the
// `WORKER_SELF_REFERENCE` service binding, so revalidation DOES propagate across
// isolates (unlike the old max_instances=3 container pool).
// NOTE: /listing/[slug] deliberately stays `force-dynamic` — exact prices must never be
// served stale.
export const revalidate = 600;

type SearchParams = { category?: string; q?: string; sort?: string };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const category = sp.category || "all";
  const q = sp.q || "";
  const sort = sp.sort || "trending";

  const res = await publishedPage({ page: 1, limit: 24, category, q, sort });
  const initialDesigns: Design[] = res.items.map(publishedToDesign);

  return (
    <ExploreClient
      initialDesigns={initialDesigns}
      initialTotal={res.total}
      initialHasMore={res.hasMore}
      initialCounts={res.counts}
      initialCategory={category}
      initialQuery={q}
      initialSort={sort}
    />
  );
}
