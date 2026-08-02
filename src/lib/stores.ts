// Shared in-memory stores for MVP.
// On Cloudflare, replace these with Workers KV / D1 / R2 bindings.
//
// Declaring the stores on `globalThis` keeps them alive across HMR reloads and lets
// every route module in the same Node.js process see the same Map.
//
// IMPORTANT (R2/C1): route handlers that touch these stores must NOT declare
// `export const runtime = "edge"`. Each edge function gets its own isolate and its
// own `globalThis`, so a session written by /api/auth/login would be invisible to
// /api/orders. Everything here is Node-runtime only.

export type GenOutput = {
  seed: string;
  width: number;
  height: number;
  palette: [string, string, string];
  shape: number;
};

export type GenJob = {
  id: string;
  user_id: string;
  status: string;
  progress: number;
  prompt: string;
  style: string;
  aspect: string;
  count: number;
  created_at: string;
  started_at: number;
  outputs: GenOutput[] | null;
  error: string | null;
};

export type OrderLineItem = {
  listing_id: string;
  title: string;
  adapter: string;
  variant: string;
  quantity: number;
  unit_price_cents: number;
};

export type OrderRecord = {
  order_id: string;
  user_id: string;
  status: string;
  items: OrderLineItem[];
  customer: { email: string; name: string };
  shipping: { address: string | null; method: string; cost_cents: number };
  pricing: {
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;
    currency: string;
  };
  manufacturing: {
    status: string;
    facility_id: string | null;
    tracking: string | null;
    lead_time_days: number;
    estimated_delivery_min: number;
    estimated_delivery_max: number;
  };
  created_at: string;
  updated_at: string;
  _created_ts: number;
  history: { status: string; note: string; ts: string }[];
};

/** A design published from Studio. Mirrors the shape of a static catalog Design. */
export type PublishedDesign = {
  id: string;
  slug: string;
  user_id: string;
  title: string;
  category: string;
  tags: string[];
  creator: string;
  creatorName: string;
  seed: string;
  palette: [string, string, string];
  shape: number;
  adapters: string[];
  premiumCents: number;
  priceCents: number;
  aiGenerated: boolean;
  prompt: string;
  created_at: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __dm_jobs: Map<string, GenJob> | undefined;
  // eslint-disable-next-line no-var
  var __dm_orders: Map<string, OrderRecord> | undefined;
  // eslint-disable-next-line no-var
  var __dm_designs: Map<string, PublishedDesign> | undefined;
}

export function jobsStore(): Map<string, GenJob> {
  if (!globalThis.__dm_jobs) globalThis.__dm_jobs = new Map();
  return globalThis.__dm_jobs;
}

export function ordersStore(): Map<string, OrderRecord> {
  if (!globalThis.__dm_orders) globalThis.__dm_orders = new Map();
  return globalThis.__dm_orders;
}

/** Designs published from Studio, keyed by slug. */
export function designsStore(): Map<string, PublishedDesign> {
  if (!globalThis.__dm_designs) globalThis.__dm_designs = new Map();
  return globalThis.__dm_designs;
}

// Fixed width for the base36 timestamp so parsing is unambiguous even after
// the value crosses into a longer digit count (~year 2059).
const TS_WIDTH = 9;

/**
 * Cryptographically secure random hex string.
 * R2/H2: `Math.random()` was previously used for session tokens and resource ids.
 * V8's xorshift128+ is not a CSPRNG — its internal state is recoverable from a
 * handful of outputs, which made both session tokens and order ids guessable.
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, "0");
  return out;
}

export function newId(prefix: string): string {
  // Encode current epoch ms in base36 as a stable, timestamp-extractable prefix so
  // status-polling endpoints can deterministically compute elapsed time, followed by
  // 64 bits of CSPRNG entropy so ids cannot be enumerated.
  const ts = Date.now().toString(36).padStart(TS_WIDTH, "0");
  return prefix + "_" + ts + randomHex(8);
}

/** Opaque session token: 256 bits of CSPRNG entropy, no embedded structure. */
export function newToken(): string {
  return randomHex(32);
}

/** Extract creation epoch ms from an id produced by newId(). */
export function idCreatedTs(id: string): number {
  try {
    const underscore = id.indexOf("_");
    const suffix = underscore >= 0 ? id.slice(underscore + 1) : id;
    const tsPart = suffix.slice(0, TS_WIDTH);
    const parsed = parseInt(tsPart, 36);
    return isNaN(parsed) ? Date.now() : parsed;
  } catch {
    return Date.now();
  }
}
