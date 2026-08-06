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

import type { SelectedProduct } from "@/lib/data";

export type GenOutput = {
  seed: string;
  width: number;
  height: number;
  palette: [string, string, string];
  shape: number;
  /** Real AI image URL when generation ran against an OpenAI-compatible provider. */
  imageUrl?: string;
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
  /** True when the job runs a real external AI model (OpenAI-compatible). */
  ai?: boolean;
  /** Demo fallback flag: deterministic preview, no external model called. */
  demo?: boolean;
};

export type OrderLineItem = {
  listing_id: string;
  title: string;
  adapter: string;
  variant: string;
  quantity: number;
  unit_price_cents: number;
  /** 可读的设计 slug（listing_id 是 dsn_ 开头的内部 id，收入明细展示用） */
  listing_slug?: string;
  // ── M3: 分成链路 ──
  /** 具体商品 SKU（M5 起必填；旧订单可能仅含 adapter） */
  sku?: string;
  /** 图片创作者 id（上传者/AI 生成者） */
  creator_id?: string;
  /** 下单时快照的分成比例 0.10–0.50 */
  royalty_rate?: number;
  /** 净价基数（cents）= 售价 − 运费分摊 − 税费分摊；不随目的地变化 */
  net_cents?: number;
  /** 该笔 line 的创作者分成（cents）= round(net_cents × royalty_rate) */
  royalty_cents?: number;
};

export type OrderRecord = {
  order_id: string;
  user_id: string;
  status: string; // "pending" | "paid" | ...
  payment: {
    ref: string;
    method: string | null;
    paid_at: string | null;
    /** Stripe PaymentIntent id, set when a real payment is initiated. */
    payment_intent_id?: string | null;
  };
  items: OrderLineItem[];
  customer: { email: string; name: string };
  shipping: { address: string | null; method: string; cost_cents: number; region?: string };
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

/**
 * A design published from Studio. Mirrors the shape of a static catalog Design.
 * `seed` / `palette` / `shape` are required for AI-generated art (they drive the
 * SVG `Artwork` renderer) but OPTIONAL for uploaded designs — an upload has a real
 * raster image in `imageUrl` and no generative seed. `source` records which path
 * produced the design; `description` is creator-supplied copy for the listing page.
 */
export type PublishedDesign = {
  id: string;
  slug: string;
  user_id: string;
  title: string;
  category: string;
  tags: string[];
  creator: string;
  creatorName: string;
  seed?: string;
  palette?: [string, string, string];
  shape?: number;
  adapters: string[];
  premiumCents: number;
  priceCents: number;
  aiGenerated: boolean;
  prompt?: string;
  description?: string;
  /** "ai" = generated in Studio; "upload" = creator supplied their own image. */
  source?: "ai" | "upload";
  // ── M3: 商品配置与创作者分成 ──
  /** 创作者分成比例 0.10–0.50；缺省时下单按 0 处理（不产生分成） */
  royaltyRate?: number;
  /** 发布时勾选的具体商品（SKU）；缺省时由 adapters 推导 family 默认 SKU（兼容旧数据） */
  selectedProducts?: SelectedProduct[];
  created_at: string;
  /** Real image URL — AI output OR uploaded raster. Rendered ahead of SVG. */
  imageUrl?: string;
};

/** Neutral fallback palette for uploaded designs that carry no generative colors. */
export const DEFAULT_PALETTE: [string, string, string] = ["#0c0c0d", "#f7f6f3", "#f7f6f3"];

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

/**
 * Read an order by id. Memory is the hot path, but because the app runs across
 * multiple container instances (max_instances=3) an order created on one instance
 * may be requested on another. When the in-memory Map misses, fall back to D1
 * (the durable store) so cross-instance requests resolve correctly.
 */
export async function getOrder(orderId: string): Promise<OrderRecord | undefined> {
  const mem = ordersStore().get(orderId);
  if (mem) return mem;
  if (!D1_ENABLED) return undefined;
  try {
    const rows = await d1Query<{ data: string }>("SELECT data FROM orders WHERE order_id = ?", [orderId]);
    if (rows.length === 0) return undefined;
    const o = JSON.parse(rows[0].data) as OrderRecord;
    ordersStore().set(o.order_id, o);
    return o;
  } catch {
    return undefined;
  }
}

/** Designs published from Studio, keyed by slug. */
export function designsStore(): Map<string, PublishedDesign> {
  if (!globalThis.__dm_designs) globalThis.__dm_designs = new Map();
  return globalThis.__dm_designs;
}

/**
 * Return every published design, merging the in-memory store with D1 (the durable
 * store). Because the app runs across up to `max_instances=3` container instances,
 * a design published on one instance only lands in that instance's memory + D1.
 * Listing endpoints must read from here so newly published designs are visible on
 * every instance immediately — without waiting for a container restart/rehydrate.
 */
export async function allPublishedDesigns(): Promise<PublishedDesign[]> {
  const map = new Map<string, PublishedDesign>();
  for (const d of designsStore().values()) map.set(d.slug, d);
  if (D1_ENABLED) {
    try {
      const rows = await d1Query<{ data: string }>("SELECT data FROM designs");
      for (const r of rows) {
        try {
          const d = JSON.parse(r.data) as PublishedDesign;
          // D1 is the durable/authoritative store — its copy wins over the memory
          // cache. This keeps a direct D1 update (e.g. the AI-image backfill, which
          // rewrote imageUrl on existing rows) visible on every container instance
          // immediately, instead of lingering stale until that instance recycles.
          map.set(d.slug, d);
        } catch { /* skip corrupt row */ }
      }
    } catch (e) {
      console.error("[db] allPublishedDesigns failed:", e instanceof Error ? e.message : e);
    }
  }
  return Array.from(map.values());
}

// ────────────────────────── D1 persistence (best-effort) ──────────────────────────
// In-memory Maps stay the hot path; every write is mirrored to D1 and stores are
// rehydrated from D1 at boot, so orders/designs survive container rebuilds.

import { d1Query, D1_ENABLED } from "@/lib/db";

export async function persistOrder(o: OrderRecord): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO orders (order_id, user_id, data, created_ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET data=excluded.data, user_id=excluded.user_id`,
    [o.order_id, o.user_id, JSON.stringify(o), o._created_ts],
  );
}

export async function persistDesign(d: PublishedDesign): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO designs (slug, user_id, data, created_ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET data=excluded.data, user_id=excluded.user_id`,
    [d.slug, d.user_id, JSON.stringify(d), Date.now()],
  );
}

/**
 * Persist a generation job. Generation runs async on the instance that received
 * the POST; because max_instances=3, the poll GET may land on a different
 * instance. Mirroring to D1 lets getJob() resolve it cross-instance once the
 * job has completed (or failed).
 */
export async function persistJob(j: GenJob): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO generation_jobs (id, user_id, data, created_ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data=excluded.data, user_id=excluded.user_id`,
    [j.id, j.user_id, JSON.stringify(j), j.started_at ?? Date.now()],
  );
}

/**
 * Read a generation job by id. Memory is the hot path; fall back to D1 so the
 * poll endpoint works even when it hits a different container instance.
 */
export async function getJob(jobId: string): Promise<GenJob | undefined> {
  const mem = jobsStore().get(jobId);
  if (mem) return mem;
  if (!D1_ENABLED) return undefined;
  try {
    const rows = await d1Query<{ data: string }>("SELECT data FROM generation_jobs WHERE id = ?", [jobId]);
    if (rows.length === 0) return undefined;
    const j = JSON.parse(rows[0].data) as GenJob;
    jobsStore().set(j.id, j);
    return j;
  } catch {
    return undefined;
  }
}

/** Reload orders + published designs from D1 into memory. Call once at server start. */
export async function hydrateOrdersAndDesigns(): Promise<void> {
  if (!D1_ENABLED) return;
  try {
    const ordRows = await d1Query<{ order_id: string; user_id: string; data: string; created_ts: number }>(
      `SELECT order_id, user_id, data, created_ts FROM orders`,
    );
    for (const r of ordRows) {
      try {
        const o = JSON.parse(r.data) as OrderRecord;
        ordersStore().set(o.order_id, o);
      } catch { /* skip corrupt row */ }
    }
    const dsgRows = await d1Query<{ slug: string; user_id: string; data: string }>(`SELECT slug, user_id, data FROM designs`);
    for (const r of dsgRows) {
      try {
        const d = JSON.parse(r.data) as PublishedDesign;
        designsStore().set(d.slug, d);
      } catch { /* skip corrupt row */ }
    }
    console.log(`[db] hydrated ${ordersStore().size} orders, ${designsStore().size} published designs`);
  } catch (e) {
    console.error("[db] hydrate orders/designs failed:", e instanceof Error ? e.message : e);
  }
}

// ────────────────────────── M3: 创作者分成（creator_earnings） ──────────────────────────

/**
 * 一笔订单行的创作者分成记录。下单支付成功后由 /api/payments/confirm 写入，
 * status 初始为 "pending"，月结手动打款时翻为 "paid"（决策 #5）。
 */
export type EarningRecord = {
  id: string;
  order_id: string;
  line_index: number;
  design_slug: string;
  creator_id: string;
  royalty_rate: number;
  net_cents: number;
  royalty_cents: number;
  status: "pending" | "paid";
  created_at: string;
  paid_at: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __dm_earnings: Map<string, EarningRecord> | undefined;
}

export function earningsStore(): Map<string, EarningRecord> {
  if (!globalThis.__dm_earnings) globalThis.__dm_earnings = new Map();
  return globalThis.__dm_earnings;
}

/**
 * Synchronous lookup of a Studio-published design by its id (same id used as
 * `listing_id` on order lines). Used by the order endpoint to read the design's
 * `royaltyRate` / `selectedProducts` synchronously. Falls back to undefined when
 * the design lives only on another container instance (cross-instance) — in that
 * case the order endpoint treats royalty as 0 (no earnings), which is safe.
 */
export function findPublishedDesignById(id: string): PublishedDesign | undefined {
  for (const p of designsStore().values()) {
    if (p.id === id || p.slug === id) return p;
  }
  return undefined;
}

/**
 * 跨实例安全版：内存未命中时回落 D1。
 * 容器 max_instances=3，某实例启动后新发布的设计不在它的内存里，
 * 只用同步版会让「刚发布的设计无法下单 / 分成拿不到 creator_id」。
 */
export async function findPublishedDesignByIdAsync(id: string): Promise<PublishedDesign | undefined> {
  const local = findPublishedDesignById(id);
  if (local) return local;
  const all = await allPublishedDesigns();
  return all.find((p) => p.id === id || p.slug === id);
}

/** 把订单中带 royalty 的行写入 creator_earnings（status=pending）。幂等：同 order_id 先清后写。 */
export async function recordOrderEarnings(order: OrderRecord): Promise<void> {
  const rows: EarningRecord[] = [];
  let created = 0;
  for (const [i, li] of (order.items ?? []).entries()) {
    if (!li.royalty_cents || li.royalty_cents <= 0 || !li.creator_id) continue;
    const rec: EarningRecord = {
      id: newId("earn"),
      order_id: order.order_id,
      line_index: i,
      design_slug: li.listing_slug || li.listing_id,
      creator_id: li.creator_id,
      royalty_rate: li.royalty_rate ?? 0,
      net_cents: li.net_cents ?? 0,
      royalty_cents: li.royalty_cents,
      status: "pending",
      created_at: new Date().toISOString(),
      paid_at: null,
    };
    rows.push(rec);
    created++;
  }
  if (created === 0) return;
  for (const r of rows) earningsStore().set(r.id, r);
  if (!D1_ENABLED) return;
  try {
    // 先删除该订单已有的 pending 记录，避免重复入账（幂等）。
    await d1Query(`DELETE FROM creator_earnings WHERE order_id = ?`, [order.order_id]);
    for (const r of rows) {
      await d1Query(
        `INSERT INTO creator_earnings (id, order_id, line_index, design_slug, creator_id, royalty_rate, net_cents, royalty_cents, status, created_at, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.order_id, r.line_index, r.design_slug, r.creator_id, r.royalty_rate, r.net_cents, r.royalty_cents, r.status, r.created_at, r.paid_at],
      );
    }
  } catch (e) {
    console.error("[db] recordOrderEarnings failed:", e instanceof Error ? e.message : e);
  }
}

/** 读取某创作者的分成汇总（pending / paid / total），跨实例需回源 D1。 */
export async function getEarningsForUser(userId: string): Promise<{
  pending_cents: number;
  paid_cents: number;
  total_cents: number;
  pending_count: number;
  paid_count: number;
}> {
  const acc = { pending_cents: 0, paid_cents: 0, total_cents: 0, pending_count: 0, paid_count: 0 };
  const tally = (r: EarningRecord) => {
    acc.total_cents += r.royalty_cents;
    if (r.status === "pending") { acc.pending_cents += r.royalty_cents; acc.pending_count++; }
    else { acc.paid_cents += r.royalty_cents; acc.paid_count++; }
  };
  for (const r of earningsStore().values()) if (r.creator_id === userId) tally(r);
  if (D1_ENABLED) {
    try {
      const rows = await d1Query<{ status: string; royalty_cents: number }>(
        `SELECT status, royalty_cents FROM creator_earnings WHERE creator_id = ?`,
        [userId],
      );
      // D1 为权威；以 D1 结果覆盖内存聚合（避免跨实例内存遗漏）。
      const reset = { pending_cents: 0, paid_cents: 0, total_cents: 0, pending_count: 0, paid_count: 0 };
      for (const r of rows) {
        const c = r.royalty_cents ?? 0;
        reset.total_cents += c;
        if (r.status === "paid") { reset.paid_cents += c; reset.paid_count++; }
        else { reset.pending_cents += c; reset.pending_count++; }
      }
      return reset;
    } catch (e) {
      console.error("[db] getEarningsForUser failed:", e instanceof Error ? e.message : e);
    }
  }
  return acc;
}

/**
 * 创作者收入明细（最近 N 条）。与 getEarningsForUser 一样以 D1 为权威，
 * 否则跨容器实例（max_instances=3）时内存里只能看到本实例产生的记录。
 */
export async function listEarningsForUser(userId: string, limit = 25): Promise<EarningRecord[]> {
  const local = Array.from(earningsStore().values())
    .filter((e) => e.creator_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
  if (!D1_ENABLED) return local;
  try {
    const rows = await d1Query<EarningRecord>(
      `SELECT id, order_id, line_index, design_slug, creator_id, royalty_rate, net_cents, royalty_cents, status, created_at, paid_at
         FROM creator_earnings WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit],
    );
    return rows.map((r) => ({ ...r, status: r.status === "paid" ? "paid" : "pending" }));
  } catch (e) {
    console.error("[db] listEarningsForUser failed:", e instanceof Error ? e.message : e);
    return local;
  }
}

/** Fixed width for the base36 timestamp so parsing is unambiguous even after
 *  the value crosses into a longer digit count (~year 2059). */
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
