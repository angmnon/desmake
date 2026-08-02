// ============================================================
// Desmake — Shared Data Layer (MVP seed data + helpers)
// ============================================================

export type Adapter = {
  id: string;
  name: string;
  mockup: string;
  method: string;
  lead: string;
  costCents: number;
  retailCents: number;
  icon: string;
};

export type Creator = {
  handle: string;
  name: string;
  city: string;
  role: string;
  verified: boolean;
  followers: number;
  sales: number;
  works: number;
  rating: number;
  bio: string;
  avatarHue: number;
};

export type Design = {
  id: string;
  slug: string;
  seed: string;
  title: string;
  creator: string;
  category: string;
  adapters: string[];
  /**
   * Creator premium in cents, added on top of the adapter base price.
   * This is a real input to `unitPriceCents` — not a separate display price.
   */
  premiumCents: number;
  /**
   * Derived "from" price = base adapter retail + premium (no variant selected).
   * Always computed from the pricing formula; never hand-authored.
   */
  priceCents: number;
  likes: number;
  views: number;
  sales: number;
  rating: number;
  reviews: number;
  aiGenerated: boolean;
  isNew: boolean;
  tags: string[];
  created: string;
  // visual seed for the SVG art generator
  palette: [string, string, string];
  shape: number;
};

export const ADAPTERS: Adapter[] = [
  { id: "tshirt", name: "T-Shirt", mockup: "tshirt", method: "DTG / DTF", lead: "3–5", costCents: 1180, retailCents: 3200, icon: "shirt" },
  { id: "poster", name: "Poster", mockup: "poster", method: "Giclée Print", lead: "2–4", costCents: 940, retailCents: 2800, icon: "frame" },
  { id: "card", name: "Business Card", mockup: "card", method: "Digital Offset", lead: "3–6", costCents: 1600, retailCents: 4200, icon: "card" },
  { id: "phonecase", name: "Phone Case", mockup: "phonecase", method: "UV Printing", lead: "3–5", costCents: 1040, retailCents: 2900, icon: "phone" },
  { id: "sticker", name: "Sticker Pack", mockup: "sticker", method: "Die Cut", lead: "2–3", costCents: 380, retailCents: 1200, icon: "sticker" },
  { id: "print3d", name: "3D Print", mockup: "print3d", method: "FDM / SLA", lead: "5–9", costCents: 2650, retailCents: 6800, icon: "cube" },
];

/**
 * Strict adapter lookup. Returns `undefined` for an unknown id.
 *
 * R2/C4: this used to fall back to `ADAPTERS[0]` (T-Shirt, $32.00), which meant a
 * malformed or mislabelled adapter identifier was silently priced as a T-Shirt —
 * 5 of the 6 adapters charged the wrong amount. Never re-introduce a fallback here;
 * pricing callers MUST handle `undefined` explicitly.
 */
export const adapterById = (id: string): Adapter | undefined => ADAPTERS.find((a) => a.id === id);

/** Display-only helper: adapter name, or the raw id when it is not a known adapter. */
export const adapterName = (id: string): string => adapterById(id)?.name ?? id;

export const CATEGORIES = [
  { id: "all", name: "All", count: 24220 },
  { id: "abstract", name: "Abstract", count: 4820 },
  { id: "typography", name: "Typography", count: 3140 },
  { id: "geometric", name: "Geometric", count: 2760 },
  { id: "illustration", name: "Illustration", count: 5210 },
  { id: "minimal", name: "Minimal", count: 3890 },
  { id: "retro", name: "Retro", count: 1930 },
  { id: "botanical", name: "Botanical", count: 1480 },
  { id: "3d", name: "3D & Objects", count: 990 },
];

const RAW_CREATORS: Array<Omit<Creator, 'avatarHue'>> = [
  { handle: "kaisu", name: "Kai Sugimoto", city: "Kyoto, JP", role: "3D Designer · AI Creator", verified: true, followers: 24800, sales: 3120, works: 48, rating: 4.9, bio: "Generative forms and quiet geometry. Building objects that feel inevitable." },
  { handle: "lenaost", name: "Lena Østergaard", city: "Copenhagen, DK", role: "Graphic Designer", verified: true, followers: 18240, sales: 2410, works: 62, rating: 4.8, bio: "Swiss grids, Nordic light. Type-led compositions for print." },
  { handle: "marcotv", name: "Marco Tavares", city: "Lisbon, PT", role: "Illustrator", verified: false, followers: 9120, sales: 880, works: 31, rating: 4.7, bio: "Hand-drawn chaos, digitally tamed." },
  { handle: "amaraok", name: "Amara Okafor", city: "Lagos, NG", role: "AI Creator", verified: true, followers: 31600, sales: 4870, works: 74, rating: 4.9, bio: "Afro-futurist pattern systems. Prompted, curated, refined." },
  { handle: "yuwen", name: "Yu Wen", city: "Shanghai, CN", role: "Artist · Printmaker", verified: true, followers: 15380, sales: 1960, works: 40, rating: 4.8, bio: "Ink, risograph, and the space between." },
  { handle: "noahb", name: "Noah Brandt", city: "Berlin, DE", role: "Type Designer", verified: false, followers: 7640, sales: 610, works: 22, rating: 4.6, bio: "Letterforms as architecture." },
  { handle: "sofiar", name: "Sofia Ruiz", city: "Mexico City, MX", role: "Illustrator · Muralist", verified: true, followers: 21050, sales: 2740, works: 55, rating: 4.9, bio: "Colour first, always." },
  { handle: "elifk", name: "Elif Kaya", city: "Istanbul, TR", role: "3D Designer", verified: false, followers: 11470, sales: 1290, works: 28, rating: 4.7, bio: "Parametric objects for the home." },
];

export const CREATORS: Creator[] = RAW_CREATORS.map((c, i) => ({ ...c, avatarHue: (i * 47 + 12) % 360 }));
/** Strict lookup — returns `undefined` for an unknown handle (no silent fallback). */
export const creatorByHandle = (h: string): Creator | undefined => CREATORS.find((c) => c.handle === h);

const PALETTES: Array<[string, string, string]> = [
  ["#ff4d18", "#0c0c0d", "#f7f6f3"],
  ["#2244ff", "#1f7a4d", "#f1efea"],
  ["#6b3df5", "#ff4d18", "#f7f6f3"],
  ["#b57500", "#0c0c0d", "#f1efea"],
  ["#1f7a4d", "#0c0c0d", "#f7f6f3"],
  ["#ff4d18", "#b57500", "#f7f6f3"],
  ["#2244ff", "#f7f6f3", "#0c0c0d"],
  ["#0c0c0d", "#f7f6f3", "#ff4d18"],
];

const RAW_DESIGNS: Array<[string, string, string, string[]]> = [
  ["Signal Decay", "kaisu", "abstract", ["poster", "tshirt", "sticker"]],
  ["Meridian 04", "lenaost", "geometric", ["poster", "card"]],
  ["Soft Machine", "amaraok", "abstract", ["tshirt", "poster", "phonecase"]],
  ["Terrazzo Sunday", "sofiar", "illustration", ["sticker", "phonecase", "poster"]],
  ["Kinetic Grid", "noahb", "typography", ["poster", "tshirt"]],
  ["Nocturne", "yuwen", "minimal", ["poster", "card", "tshirt"]],
  ["Lagos Bloom", "amaraok", "illustration", ["tshirt", "poster", "sticker"]],
  ["Vessel Study 12", "elifk", "3d", ["print3d", "poster"]],
  ["Halftone Weather", "marcotv", "retro", ["poster", "sticker"]],
  ["Copenhagen Blue", "lenaost", "minimal", ["poster", "card"]],
  ["Ember Field", "kaisu", "abstract", ["tshirt", "poster"]],
  ["Type as Object", "noahb", "typography", ["poster", "card", "sticker"]],
  ["Sunday Terrace", "sofiar", "illustration", ["poster", "phonecase"]],
  ["Inkfall", "yuwen", "abstract", ["poster", "tshirt", "sticker"]],
  ["Orbital Drift", "kaisu", "geometric", ["poster", "phonecase", "print3d"]],
  ["Paper Cut No.7", "marcotv", "minimal", ["card", "poster"]],
  ["Prism Ritual", "amaraok", "abstract", ["tshirt", "sticker", "poster"]],
  ["Static Garden", "sofiar", "botanical", ["poster", "tshirt"]],
  ["Form Follows", "elifk", "3d", ["print3d", "poster", "card"]],
  ["Long Wave", "lenaost", "geometric", ["poster", "phonecase"]],
  ["Analog Ghost", "marcotv", "retro", ["tshirt", "sticker"]],
  ["Kanji Fragment", "yuwen", "typography", ["poster", "tshirt", "card"]],
  ["Deep Field", "kaisu", "abstract", ["poster", "phonecase"]],
  ["Bauhaus Sunday", "noahb", "geometric", ["poster", "sticker", "tshirt"]],
  ["Salt Flats", "lenaost", "minimal", ["poster", "card"]],
  ["Neon Verse", "amaraok", "abstract", ["tshirt", "phonecase"]],
  ["Cactus Grammar", "sofiar", "botanical", ["poster", "sticker"]],
  ["Modular Vase", "elifk", "3d", ["print3d"]],
  ["Contour Map 09", "kaisu", "minimal", ["poster", "card", "tshirt"]],
  ["Riso Dream", "marcotv", "retro", ["poster", "sticker", "phonecase"]],
  ["Grid Interrupted", "noahb", "typography", ["poster", "tshirt"]],
  ["Blue Hour", "yuwen", "minimal", ["poster", "phonecase", "card"]],
];

const TAGPOOL = ["ai-generated", "print-ready", "vector", "editorial", "poster-art", "monochrome", "colorful", "gradient", "hand-drawn", "risograph", "swiss", "brutalist", "organic", "pattern"];

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DESIGNS: Design[] = RAW_DESIGNS.map((row, i) => {
  const r = seededRandom("design-" + row[0]);
  const adapters = row[3];
  const baseAdapter = adapterById(adapters[0]);
  if (!baseAdapter) throw new Error(`Seed design "${row[0]}" references unknown adapter "${adapters[0]}"`);
  // R2/H6: the premium is now part of the pricing formula, not a second, disconnected
  // "display price". Card price, listing price and charged price all derive from it.
  const premiumCents = Math.floor(r() * 14) * 100;
  return {
    id: "dsg_" + String(1042 + i),
    slug: row[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    seed: row[0],
    title: row[0],
    creator: row[1],
    category: row[2],
    adapters: adapters,
    premiumCents,
    priceCents: baseAdapter.retailCents + premiumCents,
    likes: 60 + Math.floor(r() * 3200),
    views: 900 + Math.floor(r() * 48000),
    sales: 4 + Math.floor(r() * 420),
    rating: parseFloat((4.3 + r() * 0.7).toFixed(1)),
    reviews: 3 + Math.floor(r() * 180),
    aiGenerated: r() > 0.45,
    isNew: i % 7 === 3,
    tags: [TAGPOOL[i % TAGPOOL.length], TAGPOOL[(i * 3 + 5) % TAGPOOL.length], row[2]],
    created: ["2 hours", "6 hours", "1 day", "2 days", "4 days", "1 week", "2 weeks", "3 weeks"][i % 8] + " ago",
    palette: PALETTES[i % PALETTES.length],
    shape: i % 6,
  };
});

/** Strict lookups — return `undefined` when there is no match (no silent fallback). */
export const designById = (id: string): Design | undefined => DESIGNS.find((d) => d.id === id);
export const designBySlug = (slug: string): Design | undefined => DESIGNS.find((d) => d.slug === slug);
export const designsByCreator = (h: string): Design[] => DESIGNS.filter((d) => d.creator === h);

/**
 * Order lifecycle states. Must stay in sync with the server-side status machine in
 * `src/app/api/orders/[id]/route.ts` — R2/M7: `routing` was missing here while the
 * API emitted it on every new order, so freshly placed orders rendered an unlabelled badge.
 */
export const ORDER_STATES = [
  { id: "paid", label: "Paid", tone: "moss" },
  { id: "routing", label: "Routing", tone: "cobalt" },
  { id: "in_production", label: "In production", tone: "amber" },
  { id: "quality_check", label: "Quality check", tone: "cobalt" },
  { id: "shipped", label: "Shipped", tone: "violet" },
  { id: "delivered", label: "Delivered", tone: "moss" },
  { id: "exception", label: "Needs attention", tone: "signal" },
];

// R2/H5: the hard-coded `ORDERS` seed array was removed. It was rendered on /orders
// whenever the signed-in user had zero real orders, showing five fabricated orders
// (with invented factories, ETAs and tracking numbers) that all 404'd when clicked.
// Order data now comes exclusively from GET /api/orders.

export const money = (cents: number, cur = "$"): string => {
  if (!Number.isFinite(cents)) return cur + "0.00";
  const neg = cents < 0;
  const v = Math.abs(cents) / 100;
  return (neg ? "-" + cur : cur) + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
};

// ============================================================
// Pricing — single source of truth (shared by client + server)
// ============================================================

/**
 * The variant catalog is the single source of truth for BOTH the UI selector and the
 * price delta. R2/M4+M5: this used to be two disconnected pieces of code — a hard-coded
 * list in the listing page plus substring matching in the pricing function. That combo
 * meant `"L · Black"` never got its $1.00 upcharge (the pattern was `"l "` with a
 * trailing space, which `"l · black"` does not contain) while any attacker-supplied
 * string containing `"xl"` did. Exact matching against this catalog fixes both.
 */
export const ADAPTER_VARIANTS: Record<string, ReadonlyArray<{ id: string; deltaCents: number }>> = {
  tshirt: [
    { id: "S · White", deltaCents: 0 },
    { id: "M · White", deltaCents: 0 },
    { id: "L · White", deltaCents: 100 },
    { id: "M · Black", deltaCents: 0 },
    { id: "L · Black", deltaCents: 100 },
    { id: "XL · Black", deltaCents: 250 },
    { id: "M · Bone", deltaCents: 0 },
  ],
  poster: [
    { id: "A3", deltaCents: 0 },
    { id: "A2", deltaCents: 400 },
    { id: "50×70cm", deltaCents: 500 },
    { id: "70×100cm", deltaCents: 800 },
  ],
  card: [
    { id: "Standard · 3.5×2", deltaCents: 0 },
    { id: "Square · 2.5×2.5", deltaCents: 200 },
    { id: "Rounded", deltaCents: 200 },
  ],
  phonecase: [
    { id: "iPhone 15", deltaCents: 0 },
    { id: "iPhone 15 Pro", deltaCents: 0 },
    { id: "Pixel 9", deltaCents: 0 },
    { id: "Galaxy S24", deltaCents: 0 },
  ],
  sticker: [
    { id: "Gloss", deltaCents: 0 },
    { id: "Matte", deltaCents: 0 },
    { id: "Holographic", deltaCents: 0 },
    { id: "Vinyl", deltaCents: 0 },
  ],
  print3d: [
    { id: "PLA · Ivory", deltaCents: 0 },
    { id: "PLA · Black", deltaCents: 0 },
    { id: "Resin · White", deltaCents: 900 },
    { id: "PLA · Terracotta", deltaCents: 0 },
  ],
};

/** Selectable variants for an adapter (UI). Empty array for an unknown adapter. */
export function variantsFor(adapterId: string): string[] {
  return (ADAPTER_VARIANTS[adapterId] ?? []).map((v) => v.id);
}

/**
 * Extra cost in cents for a product variant.
 * Returns `null` when the adapter is unknown or the variant is not in its catalog —
 * callers MUST treat `null` as "reject this line", never as zero.
 */
export function variantDeltaCents(adapterId: string, variant: string): number | null {
  const catalog = ADAPTER_VARIANTS[adapterId];
  if (!catalog) return null;
  const hit = catalog.find((v) => v.id === variant);
  return hit ? hit.deltaCents : null;
}

/**
 * The one authoritative unit price: adapter base + creator premium + variant delta.
 * Returns `null` for an unknown adapter or an out-of-catalog variant.
 *
 * R2/C4+H6: `design` is now genuinely used. Previously it was accepted and ignored,
 * while `Design.priceCents` carried a second, unrelated randomly-generated price —
 * so the same product showed three different amounts across card, listing and receipt.
 */
export function unitPriceCents(
  design: Pick<Design, "premiumCents">,
  adapterId: string,
  variant = "",
): number | null {
  const a = adapterById(adapterId);
  if (!a) return null;
  const delta = variantDeltaCents(adapterId, variant);
  if (delta === null) return null;
  return a.retailCents + design.premiumCents + delta;
}

export type TotalsLine = { priceCents: number; qty: number };

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShipping: boolean;
}

/** One pricing formula for the whole app (cart, checkout, API). */
export function computeTotals(lines: TotalsLine[]): Totals {
  const subtotal = lines.reduce((s, l) => s + Math.max(0, l.priceCents) * Math.max(0, l.qty), 0);
  const freeShipping = subtotal === 0 || subtotal >= 5000;
  const shipping = freeShipping ? 0 : 499; // free over $50
  const tax = Math.round(subtotal * 0.08); // 8% estimated tax
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    taxCents: tax,
    totalCents: subtotal + shipping + tax,
    freeShipping,
  };
}

export const HERO_STATS = [
  { v: "128,400", k: "Designs live" },
  { v: "6", k: "Adapters" },
  { v: "2,481", k: "Jobs printing now" },
  { v: "4m 12s", k: "Avg. publish time" },
];
