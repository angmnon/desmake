// Cached, process-wide index over published designs (AI + uploaded) PLUS the static
// seed catalog. Built ONCE per process (on first access / after a version bump) from
// a single D1 scan, then reused for every listing / detail / recommendation read.
//
// Why this exists: `allPublishedDesigns()` does a full `SELECT data FROM designs`
// (≈5.15 MB) + JSON.parse on EVERY call. Before this, the explore page scanned it
// once per request and the detail page scanned it 3× per view. Now the scan happens
// once per instance lifetime; all reads are O(1) / O(n-in-memory) over 4530 items.
//
// Cross-instance freshness: the index version now lives in D1 (catalog_meta) and is
// shared by every container instance. `getDesignIndex()` rebuilds whenever the shared
// version changes (bumped by `bumpDesignIndex()` on publish / backfill), so a design
// pushed on instance A becomes visible on B/C's next read within ~1s — no container
// restart required. `max_instances=3` means each instance rebuilds independently on
// cold start; the single-flight guard (see `building` below) prevents a herd of scans.

// NOTE: this module must NOT import from "@/lib/catalog" — catalog.ts imports the
// index for its async id lookup, and a cycle here breaks module init under bundling.
import { catalogIndexRows, type PublishedDesign } from "@/lib/stores";
import { DESIGNS, type Design } from "@/lib/data";
import { getDesignIndexVersion } from "@/lib/catalogVersion";

export type DesignIndex = {
  all: PublishedDesign[];
  bySlug: Map<string, PublishedDesign>;
  byId: Map<string, PublishedDesign>;
  byCategory: Map<string, PublishedDesign[]>;
  byCreator: Map<string, PublishedDesign[]>;
  byTag: Map<string, PublishedDesign[]>;
  counts: Record<string, number>;
  version: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __dm_designIndex: DesignIndex | undefined;
  // eslint-disable-next-line no-var
  var __dm_relatedCache: Map<string, PublishedDesign[]> | undefined;
}

/** Map the static seed catalog Design into the PublishedDesign shape so it shares
 *  the same pagination / filter / recommendation pipeline as real published art. */
function seedToPublished(d: Design): PublishedDesign {
  return {
    id: d.id,
    slug: d.slug,
    user_id: "seed",
    title: d.title,
    category: d.category,
    tags: d.tags ?? [],
    creator: d.creator,
    creatorName: d.creator,
    seed: d.seed,
    palette: d.palette,
    shape: d.shape,
    adapters: d.adapters,
    premiumCents: d.premiumCents ?? 0,
    priceCents: d.priceCents,
    aiGenerated: d.aiGenerated,
    prompt: undefined,
    description: undefined,
    source: undefined,
    royaltyRate: 0,
    selectedProducts: d.selectedProducts,
    // Seeds have no real publish timestamp; sort them to the back for "newest".
    created_at: "2000-01-01T00:00:00.000Z",
    imageUrl: d.imageUrl,
    // M-8: the core seed catalog is always purchasable.
    status: "published",
  };
}

function pushMap(map: Map<string, PublishedDesign[]>, key: string, v: PublishedDesign) {
  const arr = map.get(key);
  if (arr) arr.push(v);
  else map.set(key, [v]);
}

// P2-3: single-flight guard. On a cold instance, several concurrent requests can
// otherwise each trigger the 5 MB D1 scan at once (thundering herd). The first
// caller builds the index; everyone else awaits the same promise.
let building: Promise<DesignIndex> | null = null;

export async function getDesignIndex(): Promise<DesignIndex> {
  const currentVersion = await getDesignIndexVersion();
  const cached = globalThis.__dm_designIndex;
  if (cached && cached.version === currentVersion) return cached;
  if (building) return building;
  building = (async () => {
    try {
      // P0-2: projection query (json_extract) instead of parsing the full ~5 MB blob.
      const pub = await catalogIndexRows();
      const all: PublishedDesign[] = [...pub, ...DESIGNS.map(seedToPublished)];
      const idx: DesignIndex = {
        all,
        bySlug: new Map(),
        byId: new Map(),
        byCategory: new Map(),
        byCreator: new Map(),
        byTag: new Map(),
        counts: {},
        version: currentVersion,
      };
      for (const d of all) {
        if (d.slug) idx.bySlug.set(d.slug, d);
        if (d.id) idx.byId.set(d.id, d);
        if (d.category) pushMap(idx.byCategory, d.category, d);
        if (d.creator) pushMap(idx.byCreator, d.creator, d);
        for (const t of d.tags || []) pushMap(idx.byTag, t.toLowerCase(), d);
      }
      for (const [cat, arr] of idx.byCategory) idx.counts[cat] = arr.length;
      globalThis.__dm_designIndex = idx;
      // Version bumped — drop any cached recommendations so stale recs don't linger.
      globalThis.__dm_relatedCache = undefined;
      return idx;
    } finally {
      building = null;
    }
  })();
  return building;
}

export type PageOpts = {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  creator?: string;
  adapter?: string | null;
  q?: string;
  sort?: string;
  excludeSlug?: string;
};

const SORTS = new Set(["trending", "new", "newest", "price_asc", "price_desc"]);

export async function publishedPage(opts: PageOpts = {}) {
  const {
    page = 1,
    limit = 24,
    category,
    tag,
    creator,
    adapter,
    q,
    sort = "trending",
    excludeSlug,
  } = opts;

  const idx = await getDesignIndex();
  let items = idx.all;

  if (category && category !== "all") items = items.filter((d) => d.category === category);
  if (creator) items = items.filter((d) => d.creator === creator);
  if (adapter) items = items.filter((d) => (d.adapters || []).includes(adapter));
  if (tag) {
    const t = tag.toLowerCase();
    items = items.filter((d) => (d.tags || []).some((x) => x.toLowerCase() === t));
  }
  if (q) {
    const s = q.toLowerCase();
    items = items.filter(
      (d) =>
        (d.title || "").toLowerCase().includes(s) ||
        (d.creator || "").toLowerCase().includes(s) ||
        (d.tags || []).some((x) => x.toLowerCase().includes(s)),
    );
  }
  if (excludeSlug) items = items.filter((d) => d.slug !== excludeSlug);

  const sorted = sortList(items, SORTS.has(sort) ? sort : "trending");
  const total = sorted.length;
  const safeLimit = Math.min(Math.max(1, limit), 60);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * safeLimit;
  const pageItems = sorted.slice(start, start + safeLimit);

  return {
    items: pageItems,
    total,
    totalPages,
    page: p,
    limit: safeLimit,
    hasMore: start + safeLimit < total,
    counts: idx.counts,
  };
}

function sortList(list: PublishedDesign[], sort: string): PublishedDesign[] {
  const arr = [...list];
  switch (sort) {
    case "new":
    case "newest":
      // Newest-first. Seeds carry a 2000 timestamp so they naturally fall to the back.
      arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      break;
    case "price_asc":
      arr.sort((a, b) => a.priceCents - b.priceCents);
      break;
    case "price_desc":
      arr.sort((a, b) => b.priceCents - a.priceCents);
      break;
    case "trending":
    default:
      // No real view/like signal yet (catalog hardcodes 0), so use recency as the
      // trending proxy — freshly published art surfaces first.
      arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      break;
  }
  return arr;
}

export async function findPublishedBySlug(slug: string): Promise<PublishedDesign | undefined> {
  const idx = await getDesignIndex();
  return idx.bySlug.get(slug);
}

/** O(1) id-or-slug lookup — used by order creation, which must never trust memory only. */
export async function findPublishedByIdOrSlug(id: string): Promise<PublishedDesign | undefined> {
  const idx = await getDesignIndex();
  return idx.byId.get(id) ?? idx.bySlug.get(id);
}

/** Most-used tags across the whole catalogue, for filter chips. Index-backed, no scan. */
export async function catalogTags(limit = 30): Promise<string[]> {
  const idx = await getDesignIndex();
  return [...idx.byTag.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([t]) => t);
}

// ────────────────────────── Content-based recommendations ──────────────────────────
// Used by the detail page "You may also like" row. Pure metadata scoring over the
// in-memory index (4530 items ≈ single-digit ms), no external model.

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 0 (different) → 1 (identical) perceptual-ish distance over 3 palette colors. */
function paletteSim(a?: [string, string, string], b?: [string, string, string]): number {
  if (!a || !b) return 0;
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const ca = hexToRgb(a[i]);
    const cb = hexToRgb(b[i]);
    if (!ca || !cb) return 0;
    sum += Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2);
  }
  return 1 - Math.min(1, sum / (3 * 441.673));
}

export async function relatedFor(slug: string, n = 8): Promise<PublishedDesign[]> {
  const idx = await getDesignIndex();
  const base = idx.bySlug.get(slug);
  if (!base) return [];
  // P1-3: cache the scored list per slug, keyed by the index version so it is
  // invalidated automatically whenever the catalog rebuilds. Bounded to avoid a
  // slow memory leak across 4.5k detail pages.
  const cache = (globalThis.__dm_relatedCache ??= new Map());
  if (cache.size > 4096) cache.clear();
  const key = `${slug}@${idx.version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const baseTags = new Set((base.tags || []).map((t) => t.toLowerCase()));
  const scored: Array<{ d: PublishedDesign; score: number }> = [];
  for (const d of idx.all) {
    if (d.slug === slug) continue;
    let score = 0;
    if (d.category === base.category) score += 3;
    if (d.creator === base.creator) score += 4;
    if (d.source === base.source) score += 1;
    const dtags = new Set((d.tags || []).map((t) => t.toLowerCase()));
    let overlap = 0;
    for (const t of baseTags) if (dtags.has(t)) overlap++;
    score += overlap * 2;
    score += paletteSim(base.palette, d.palette) * 2;
    if (base.shape !== undefined && base.shape === d.shape) score += 1;
    if (score <= 0) continue;
    scored.push({ d, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, n).map((s) => s.d);
  cache.set(key, result);
  return result;
}
