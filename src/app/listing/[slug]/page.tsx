import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findPublishedBySlug } from "@/lib/catalogIndex";
import { publishedToDesign } from "@/lib/catalog";
import ListingView from "./ListingView";

/**
 * P2: the product page is now a Server Component.
 *
 * Before: a client component mounted, rendered a "Loading design…" placeholder,
 * then fetched /api/listings/<slug>, which itself did a full 5.15 MB D1 scan.
 * Every view cost one blank frame + one round trip + one full-table parse.
 *
 * Now: the slug is resolved server-side against the cached in-memory design index
 * (O(1) map lookup, no D1 scan after the first build), and the fully-populated
 * markup is streamed in the first response. Only interaction state (SKU picker,
 * qty, cart) and recommendations stay client-side, inside <ListingView>.
 */
// Rendered per request on purpose (force-dynamic). P1-2 revisited 2026-08-18: the
// shared-version index (catalog_meta) now keeps the *data* fresh across all
// max_instances=3 instances, but exact prices/availability must never be served
// from a stale edge-cached HTML shell — and `revalidatePath` does not propagate
// across the instance pool. So the listing detail page stays dynamic; only /explore
// moved to ISR. Full-route ISR over 4.5k slugs would risk serving a stale price
// after a re-publish, which this project has already been burned by.
export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = await findPublishedBySlug(slug);
  if (!base) notFound();
  // Suspense required because <ListingView> reads URL search params (?sku/&variant)
  // to deep-link a pre-selected product from a shared link.
  return (
    <Suspense fallback={null}>
      <ListingView design={publishedToDesign(base)} />
    </Suspense>
  );
}
