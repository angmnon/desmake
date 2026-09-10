import type { MetadataRoute } from "next";
import { DESIGNS, CREATORS, CATEGORIES } from "@/lib/data";
import { getAllPosts } from "@/lib/blog";
import { getDesignIndex } from "@/lib/catalogIndex";
import { allRealCreators } from "@/lib/creators";

const BASE = "https://desmake.com";

// Disable route caching: the sitemap enumerates live D1 data and changes every
// deploy. A stale cache would freeze an outdated index (and poison the edge).
export const dynamic = "force-dynamic";

/** Seed data stores `created` as a human relative string ("2 hours ago"); only
 *  safe-parse it. Anything unparseable falls back to "now" so the sitemap
 *  serialises instead of throwing `Invalid time value`. */
function safeLastModified(v: unknown): Date {
  if (!v) return new Date();
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Dynamic sitemap. Previously this only listed ~13 static marketing pages, so the
 * entire indexable catalogue (every /listing/<slug> and /creators/<handle>) was
 * invisible to search engines. We now enumerate:
 *   - static marketing/legal pages
 *   - every seed design + every Studio-published design (D1)
 *   - every creator profile
 *   - category landing views on /explore
 * This is the single biggest SEO lever for a marketplace: it exposes thousands of
 * long-tail product pages that each target a unique query.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: Array<{ p: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { p: "", priority: 1.0, freq: "daily" },
    { p: "/explore", priority: 0.9, freq: "daily" },
    { p: "/creators", priority: 0.8, freq: "daily" },
    { p: "/agents", priority: 0.9, freq: "weekly" },
    { p: "/docs", priority: 0.7, freq: "weekly" },
    { p: "/pricing", priority: 0.8, freq: "weekly" },
    { p: "/about", priority: 0.6, freq: "monthly" },
    { p: "/payouts", priority: 0.6, freq: "monthly" },
    { p: "/quality", priority: 0.5, freq: "monthly" },
    { p: "/shipping", priority: 0.5, freq: "monthly" },
    { p: "/guidelines", priority: 0.4, freq: "monthly" },
    { p: "/contact", priority: 0.4, freq: "monthly" },
    { p: "/blog", priority: 0.7, freq: "weekly" },
    { p: "/news", priority: 0.6, freq: "weekly" },
    { p: "/faq", priority: 0.6, freq: "weekly" },
    { p: "/privacy", priority: 0.3, freq: "yearly" },
    { p: "/terms", priority: 0.3, freq: "yearly" },
    { p: "/cookies", priority: 0.3, freq: "yearly" },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map(({ p, priority, freq }) => ({
    url: BASE + p,
    lastModified: now,
    changeFrequency: freq,
    priority,
  }));

  // ── Category landing views (query-param pages are valid, indexable URLs) ──
  const categories = Array.from(new Set(DESIGNS.map((d) => d.category))).filter(Boolean);
  for (const c of categories) {
    entries.push({
      url: `${BASE}/explore?category=${encodeURIComponent(c)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // ── Creator profiles ──
  // Static "Desmake Select" seed creators first, then real registered creators
  // (who published ≥1 design) — deduped by handle so a real creator who also
  // appears in the seed is not listed twice.
  const creatorHandles = new Set<string>();
  for (const c of CREATORS) {
    creatorHandles.add(c.handle);
    entries.push({
      url: `${BASE}/creators/${encodeURIComponent(c.handle)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  const realCreators = await allRealCreators();
  for (const rc of realCreators) {
    if (creatorHandles.has(rc.user.handle)) continue;
    creatorHandles.add(rc.user.handle);
    entries.push({
      url: `${BASE}/creators/${encodeURIComponent(rc.user.handle)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // ── Every design detail page (seed catalogue + Studio-published), index-backed ──
  // Uses the cached design index instead of a fresh 5 MB `allPublishedDesigns()`
  // scan per request — one cached build, O(n) over ~4.5k items.
  const idx = await getDesignIndex();
  for (const d of idx.all) {
    if (!d.slug) continue;
    entries.push({
      url: `${BASE}/listing/${encodeURIComponent(d.slug)}`,
      lastModified: safeLastModified(d.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // ── Programmatic SEO landing pages (vs / use-cases / categories) ──
  const vs = ["printful", "printify", "redbubble"];
  for (const s of vs) entries.push({ url: `${BASE}/vs/${s}`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  const useCases = ["ai-artist", "merch-brand", "agent-commerce"];
  for (const s of useCases) entries.push({ url: `${BASE}/use-cases/${s}`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  for (const c of CATEGORIES) {
    if (c.id === "all") continue;
    entries.push({ url: `${BASE}/categories/${c.id}`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
  }

  // ── Blog posts ──
  for (const p of getAllPosts()) {
    entries.push({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: safeLastModified(p.date),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // ── CMS posts published via the /api/cms API (news / blog / faq) ──
  try {
    const { listCmsPosts } = await import("@/lib/cms");
    const cms = await listCmsPosts({ status: "published", limit: 500 });
    for (const p of cms) {
      const base = p.type === "news" ? "/news" : p.type === "faq" ? "/faq" : "/blog";
      entries.push({
        url: `${BASE}${base}/${p.slug}`,
        // D7-10: CMS `published_at` is an epoch number that can be absent/NaN on
        // legacy rows — a bare `new Date(...)` yielded an Invalid Date and could
        // break the whole sitemap. Route it through the same safe parser.
        lastModified: safeLastModified(p.published_at),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // D1 unavailable — skip CMS entries rather than failing the whole sitemap.
  }

  return entries;
}
