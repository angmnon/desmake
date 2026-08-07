import type { MetadataRoute } from "next";
import { DESIGNS, CREATORS, CATEGORIES } from "@/lib/data";
import { allPublishedDesigns } from "@/lib/stores";
import { publishedToDesign } from "@/lib/catalog";

const BASE = "https://desmake.com";

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
  for (const c of CREATORS) {
    entries.push({
      url: `${BASE}/creators/${encodeURIComponent(c.handle)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // ── Every design detail page (seed catalogue + Studio-published) ──
  const bySlug = new Map<string, { created?: string }>();
  for (const d of DESIGNS) bySlug.set(d.slug, { created: d.created });
  try {
    const published = await allPublishedDesigns();
    for (const p of published) {
      const d = publishedToDesign(p);
      bySlug.set(d.slug, { created: d.created });
    }
  } catch {
    /* D1 disabled — seed catalogue still ships in the sitemap */
  }
  for (const [slug, meta] of bySlug) {
    entries.push({
      url: `${BASE}/listing/${encodeURIComponent(slug)}`,
      lastModified: safeLastModified(meta.created),
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

  return entries;
}
