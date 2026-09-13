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
// Cache-version module is intentionally dependency-free so importing it here cannot
// create a cycle (stores -> catalogVersion, catalogIndex -> stores + catalogVersion).
import { bumpDesignIndex } from "@/lib/catalogVersion";
import { recordError, notifyAlert } from "@/lib/monitor";

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
  // ── M-UGC: 推荐归因 ──
  /** 带来这笔 line 下单的推荐人 user_id（来自 dm_ref cookie 或注册 referred_by）；反自推后为 undefined */
  referrer_id?: string;
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
  // H-6: 结构化收货信息。此前整单只有一个 address 字符串（且被截断到 300 字符），
  // 没有国家/城市/邮编/电话独立字段，国际订单实际无法报关与派送。
  // 全部为可选字段，保证历史订单数据向后兼容。
  shipping: {
    address: string | null;
    method: string;
    cost_cents: number;
    region?: string;
    /** 街道地址第一行 */
    line1?: string | null;
    /** 公寓/单元/公司等第二行 */
    line2?: string | null;
    city?: string | null;
    /** 州/省 */
    state?: string | null;
    postal_code?: string | null;
    /** ISO 3166-1 alpha-2 国家码，同时决定税率档位 */
    country?: string | null;
    phone?: string | null;
  };
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
  // ── M-UGC: 推荐归因 ──
  /** 带来这笔订单的推荐人 user_id（dm_ref cookie 末次点击 或 注册 referred_by 终身记忆）；反自推后为 null */
  referrer_id?: string | null;
  /**
   * M-9: 客户端幂等键。网络抖动或用户双击会创建多笔 pending 订单，若两笔都进入
   * 支付流程就会重复扣款。带上同一个 key 重试应返回首次创建的订单。
   */
  idempotency_key?: string | null;
  // ── P0-2: 付费投放归因（UTM / 点击 ID），用于把收入归到具体广告系列 ──
  acquisition?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    gclid?: string | null;
    fbclid?: string | null;
    landing?: string | null;
  } | null;
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
  /** M-UGC: the publishing user's public handle, used for the creator profile URL. */
  creatorHandle?: string;
  /** M-UGC: curator-verified badge snapshot at publish time. */
  creatorVerified?: boolean;
  seed?: string;
  palette?: [string, string, string];
  shape?: number;
  adapters: string[];
  premiumCents: number;
  priceCents: number;
  aiGenerated: boolean;
  /**
   * M-9: true when the published image is a deterministic placeholder (no AI
   * provider configured) rather than a real AI generation. Lets the UI badge it
   * honestly instead of presenting a placeholder as "AI-generated".
   */
  isPreview?: boolean;
  prompt?: string;
  description?: string;
  /** "ai" = generated in Studio; "upload" = creator supplied their own image. */
  source?: "ai" | "upload";
  // ── M3: 商品配置与创作者分成 ──
  /** 创作者分成比例 0.10–0.50；缺省时下单按 0 处理（不产生分成） */
  royaltyRate?: number;
  /** 创作者档位（standard/early/founding），发布时从 users.creator_tier 快照，用于抬高分成比例 */
  creatorTier?: string;
  /** 发布时勾选的具体商品（SKU）；缺省时由 adapters 推导 family 默认 SKU（兼容旧数据） */
  selectedProducts?: SelectedProduct[];
  created_at: string;
  /** Real image URL — AI output OR uploaded raster. Rendered ahead of SVG. */
  imageUrl?: string;
  /**
   * M-8: lifecycle status. Only "published" designs are purchasable; a draft /
   * archived / sold_out design must be refused at checkout. Absent on legacy rows
   * and seed catalog entries, which are treated as published (see orders/route.ts).
   */
  status?: string;
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
// M-3: allPublishedDesigns() does a full `SELECT data FROM designs` + per-row JSON.parse
// (the ~5 MB blob scan). It is called from the creators page, dashboard, and order lookup,
// so without caching those paths re-scan the whole table on every request. Cache the merged
// result for a short window; persistDesign() invalidates it on write so new publications
// still surface promptly.
let __cachedAllDesigns: PublishedDesign[] | null = null;
let __cachedAllAt = 0;
const ALL_DESIGNS_TTL_MS = Number(process.env.ALL_DESIGNS_TTL_MS || 20000);

export async function allPublishedDesigns(): Promise<PublishedDesign[]> {
  const now = Date.now();
  if (__cachedAllDesigns && now - __cachedAllAt < ALL_DESIGNS_TTL_MS) return __cachedAllDesigns;
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
  const result = Array.from(map.values());
  __cachedAllDesigns = result;
  __cachedAllAt = now;
  return result;
}

/**
 * P0-2 / P2-3: lightweight projection used to (re)build the in-memory catalog index.
 *
 * Unlike `allPublishedDesigns()` (which does `SELECT data FROM designs` and
 * JSON.parses the full ~5 MB blob per row), this extracts only the index-relevant
 * columns via `json_extract` and parses just those small fragments — so a rebuild
 * no longer pays the full-blob parse cost. The in-process `designsStore()` map is
 * merged first (so a design published on this very instance is present immediately).
 *
 * Falls back to `allPublishedDesigns()` on any parse/query error so a malformed row
 * can never take the catalog offline.
 */
export async function catalogIndexRows(): Promise<PublishedDesign[]> {
  const map = new Map<string, PublishedDesign>();
  for (const d of designsStore().values()) map.set(d.slug, d);
  if (!D1_ENABLED) return Array.from(map.values());
  try {
    const rows = await d1Query<Record<string, string | null>>(
      `SELECT
         json_extract(data,'$.id')               AS id,
         slug,
         json_extract(data,'$.user_id')          AS user_id,
         json_extract(data,'$.title')            AS title,
         json_extract(data,'$.category')          AS category,
         json_extract(data,'$.tags')             AS tags,
         json_extract(data,'$.creator')           AS creator,
         json_extract(data,'$.creatorName')       AS creatorName,
         json_extract(data,'$.creatorHandle')     AS creatorHandle,
         json_extract(data,'$.creatorVerified')   AS creatorVerified,
         json_extract(data,'$.seed')              AS seed,
         json_extract(data,'$.palette')           AS palette,
         json_extract(data,'$.shape')             AS shape,
         json_extract(data,'$.adapters')          AS adapters,
         json_extract(data,'$.premiumCents')      AS premiumCents,
         json_extract(data,'$.priceCents')        AS priceCents,
         json_extract(data,'$.aiGenerated')       AS aiGenerated,
         json_extract(data,'$.source')            AS source,
         json_extract(data,'$.royaltyRate')       AS royaltyRate,
         json_extract(data,'$.selectedProducts')  AS selectedProducts,
         json_extract(data,'$.created_at')        AS created_at,
         json_extract(data,'$.imageUrl')          AS imageUrl,
         json_extract(data,'$.status')            AS pstatus
       FROM designs`,
    );
    for (const r of rows) {
      try {
        if (!r.slug) continue;
        const d: PublishedDesign = {
          id: (r.id as string) || (r.slug as string),
          slug: r.slug as string,
          user_id: (r.user_id as string) || "seed",
          title: (r.title as string) || (r.slug as string),
          category: (r.category as string) || "",
          tags: r.tags ? (JSON.parse(r.tags as string) as string[]) : [],
          creator: (r.creator as string) || "",
          creatorName: (r.creatorName as string) || (r.creator as string) || "",
          creatorHandle: r.creatorHandle ? (r.creatorHandle as string) : undefined,
          creatorVerified: Boolean(r.creatorVerified),
          seed: (r.seed as string) || (r.slug as string),
          palette: r.palette ? (JSON.parse(r.palette as string) as [string, string, string]) : undefined,
          shape: r.shape ? Number(r.shape) : undefined,
          adapters: r.adapters ? (JSON.parse(r.adapters as string) as string[]) : [],
          premiumCents: Number(r.premiumCents) || 0,
          priceCents: Number(r.priceCents) || 0,
          aiGenerated: Boolean(r.aiGenerated),
          source: (r.source as "ai" | "upload") || undefined,
          royaltyRate: r.royaltyRate ? Number(r.royaltyRate) : 0,
          selectedProducts: r.selectedProducts
            ? (JSON.parse(r.selectedProducts as string) as SelectedProduct[])
            : undefined,
          created_at: (r.created_at as string) || "2000-01-01T00:00:00.000Z",
          imageUrl: r.imageUrl ? (r.imageUrl as string) : undefined,
          status: (r.pstatus as string) || undefined,
        };
        // D1 is authoritative — its copy wins over the memory cache.
        map.set(d.slug, d);
      } catch {
        /* skip corrupt row */
      }
    }
  } catch (e) {
    console.error("[db] catalogIndexRows failed, falling back to full blob:", e instanceof Error ? e.message : e);
    return allPublishedDesigns();
  }
  return Array.from(map.values());
}
// In-memory Maps stay the hot path; every write is mirrored to D1 and stores are
// rehydrated from D1 at boot, so orders/designs survive container rebuilds.

import { d1Query, d1Run, D1_ENABLED } from "@/lib/db";
export async function persistOrder(o: OrderRecord): Promise<void> {
  if (!D1_ENABLED) return;
  // R2: also mirror the hot lookup keys into indexed columns (idempotency replay +
  // refund-webhook PaymentIntent lookup) so those queries are index seeks, not blob scans.
  await d1Query(
    `INSERT INTO orders (order_id, user_id, data, created_ts, idempotency_key, payment_intent_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET
        data=excluded.data, user_id=excluded.user_id,
        idempotency_key=excluded.idempotency_key, payment_intent_id=excluded.payment_intent_id`,
    [o.order_id, o.user_id, JSON.stringify(o), o._created_ts, o.idempotency_key ?? null, o.payment?.payment_intent_id ?? null],
  );
}

/**
 * R2/M-1: cross-instance idempotency. Look an order up by (user_id, idempotency_key) in
 * D1 (the durable store) so a retry that lands on a different isolate replays the original
 * order instead of creating a second pending order.
 */
export async function findOrderByIdempotencyKey(userId: string, key: string): Promise<OrderRecord | undefined> {
  if (!key) return undefined;
  for (const o of ordersStore().values()) {
    if (o.user_id === userId && o.idempotency_key === key) return o;
  }
  if (!D1_ENABLED) return undefined;
  try {
    const rows = await d1Query<{ data: string }>(
      `SELECT data FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
      [userId, key],
    );
    if (rows.length === 0) return undefined;
    return JSON.parse(rows[0].data) as OrderRecord;
  } catch (e) {
    console.error("[db] findOrderByIdempotencyKey failed:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * H-1 fix: list a user's orders from D1 (source of truth) merged with the in-memory
 * store.
 *
 * `GET /api/orders` previously read ONLY the per-isolate in-memory Map, so on
 * Cloudflare's multi-isolate runtime a buyer's freshly placed — and paid — order was
 * invisible on roughly two of three requests. The order detail route did fall back to
 * D1, which made it worse: the order existed but never showed up in "My orders".
 * Buyers conclude they were scammed and open chargebacks.
 */
export async function listOrdersForUserAsync(userId: string, limit = 100): Promise<OrderRecord[]> {
  const merged = new Map<string, OrderRecord>();
  for (const o of ordersStore().values()) {
    if (o.user_id === userId) merged.set(o.order_id, o);
  }
  if (D1_ENABLED) {
    try {
      const rows = await d1Query<{ data: string }>(
        `SELECT data FROM orders WHERE user_id = ? ORDER BY created_ts DESC LIMIT ?`,
        [userId, limit],
      );
      for (const r of rows) {
        try {
          const parsed = JSON.parse(r.data) as OrderRecord;
          if (!parsed?.order_id) continue;
          // An in-memory copy can be a few milliseconds newer than D1 (written before
          // the durable round-trip finished), so keep whichever is freshest.
          const existing = merged.get(parsed.order_id);
          if (!existing || (parsed._created_ts || 0) >= (existing._created_ts || 0)) {
            merged.set(parsed.order_id, parsed);
          }
        } catch {
          /* skip unparseable row rather than failing the whole list */
        }
      }
    } catch (e) {
      console.error("[db] listOrdersForUserAsync failed:", e instanceof Error ? e.message : e);
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => (b._created_ts || 0) - (a._created_ts || 0))
    .slice(0, limit);
}

export async function persistDesign(d: PublishedDesign): Promise<void> {
  if (!D1_ENABLED) return;
  // P0-1: write the row to D1 FIRST, then bump the shared index version. Ordering
  // matters — if we bumped the version before the row landed, another instance could
  // rebuild its index in the gap and cache the new version with the design still
  // missing, never seeing it until the next publish. Writing first guarantees that
  // once `getDesignIndexVersion()` reports the bump, the row is already queryable.
  await d1Query(
    `INSERT INTO designs (slug, user_id, data, created_ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET data=excluded.data, user_id=excluded.user_id`,
    [d.slug, d.user_id, JSON.stringify(d), Date.now()],
  );
  // Invalidate the cached design index so the next read rebuilds and picks up this
  // design immediately (cross-instance visibility without a container restart).
  // R2: clear the local caches BEFORE the bump so a bump failure can't leave this
  // instance serving a stale list either.
  __cachedAllDesigns = null;
  try {
    await bumpDesignIndex();
  } catch (e) {
    // The row is written and the publish itself succeeded — do not fail it. Surface the
    // cross-instance visibility risk instead of swallowing it (previously a silent swallow
    // could leave the design invisible everywhere but the publishing instance).
    recordError("persistDesign.bumpDesignIndex", e);
    void notifyAlert(
      "Design index version bump FAILED",
      `design ${d.slug} may stay invisible on other instances until the next successful publish`,
    );
  }
}

/**
 * List a single user's published designs from D1 (durable, cross-instance).
 *
 * Previously the "my designs" endpoint read only this isolate's in-memory map,
 * so the account page showed an empty list whenever the request landed on an
 * instance that had not seen the publish (up to max_instances). Memory is used
 * only as a fallback when D1 is unavailable.
 */
export async function listDesignsForUserAsync(userId: string, limit = 200): Promise<PublishedDesign[]> {
  if (D1_ENABLED) {
    try {
      const rows = await d1Query<{ data: string }>(
        `SELECT data FROM designs WHERE user_id = ? ORDER BY created_ts DESC LIMIT ?`,
        [userId, limit],
      );
      const out: PublishedDesign[] = [];
      for (const r of rows) {
        try {
          out.push(JSON.parse(r.data) as PublishedDesign);
        } catch {
          /* skip corrupt row */
        }
      }
      return out;
    } catch (e) {
      recordError("listDesignsForUserAsync", e);
    }
  }
  return Array.from(designsStore().values())
    .filter((d) => d.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

/**
 * R2-M-8: delete a design the caller owns. Returns the removed record (so the
 * caller can also delete its R2 image and avoid orphans), or null when the
 * design does not exist OR is not owned by `userId` — the caller cannot
 * distinguish the two, so this is not an existence oracle.
 */
export async function deleteDesignForUserAsync(slug: string, userId: string): Promise<PublishedDesign | null> {
  const mem = designsStore().get(slug);
  let existing: PublishedDesign | null = mem && mem.user_id === userId ? mem : null;
  if (!existing && D1_ENABLED) {
    try {
      const rows = await d1Query<{ data: string }>(
        `SELECT data FROM designs WHERE slug = ? AND user_id = ?`,
        [slug, userId],
      );
      if (rows.length) {
        try {
          existing = JSON.parse(rows[0].data) as PublishedDesign;
        } catch {
          existing = null;
        }
      }
    } catch (e) {
      recordError("deleteDesignForUserAsync.read", e);
    }
  }
  if (!existing) return null;

  if (D1_ENABLED) {
    // Loud on failure: a swallowed error would leave the listing purchasable
    // after the creator believes they deleted it.
    await d1Run(`DELETE FROM designs WHERE slug = ? AND user_id = ?`, [slug, userId]);
  }
  designsStore().delete(slug);
  __cachedAllDesigns = null;
  try {
    await bumpDesignIndex();
  } catch (e) {
    recordError("deleteDesignForUserAsync.bump", e);
    void notifyAlert("Design delete: index bump FAILED", `slug ${slug} may linger in other instances' index`);
  }
  return existing;
}

/**
 * R2-M-9: read one of the caller's own designs (memory first, fall back to D1).
 * Used by the in-place PATCH handler so an update never has to delete+recreate
 * (which would collide with other instances' still-cached slug and rename it
 * to `slug-2`).
 */
export async function getDesignBySlugForUser(slug: string, userId: string): Promise<PublishedDesign | null> {
  const mem = designsStore().get(slug);
  let d = mem && mem.user_id === userId ? mem : null;
  if (!d && D1_ENABLED) {
    try {
      const rows = await d1Query<{ data: string }>(
        `SELECT data FROM designs WHERE slug = ? AND user_id = ?`,
        [slug, userId],
      );
      if (rows.length) d = JSON.parse(rows[0].data) as PublishedDesign;
    } catch (e) {
      recordError("getDesignBySlugForUser.read", e);
    }
  }
  return d;
}

/**
 * R2-M-9: persist an in-place update to an existing design (adapters/tags/etc.)
 * by overwriting the D1 row, refreshing this instance's memory, and bumping the
 * shared index version so other instances re-read the authoritative D1 copy.
 */
export async function updateDesignForUserAsync(d: PublishedDesign): Promise<void> {
  if (D1_ENABLED) {
    // The `designs` table has no `id` column — the id lives inside the `data` JSON.
    // Key the UPDATE on (slug, user_id), which are real columns.
    await d1Run(`UPDATE designs SET data = ? WHERE slug = ? AND user_id = ?`, [
      JSON.stringify(d),
      d.slug,
      d.user_id,
    ]);
  }
  designsStore().set(d.slug, d);
  __cachedAllDesigns = null;
  try {
    await bumpDesignIndex();
  } catch (e) {
    recordError("updateDesignForUserAsync.bump", e);
  }
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
    // Return the authoritative D1 snapshot. Do NOT cache it into this isolate's
    // in-memory store: on Cloudflare Workers each isolate has its own `globalThis`,
    // so caching a D1 read here would serve a stale snapshot forever on isolates
    // that didn't create the job (live progress lives only on the creating isolate's
    // memory). The final job state is always persisted to D1, so D1 is the source of truth.
    return JSON.parse(rows[0].data) as GenJob;
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
  status: "pending" | "paid" | "reversed";
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
  // M-10: never record earnings for an order that has already been refunded/disputed.
  // A refund can arrive out of order (or on another isolate) before or after this write;
  // consulting D1 keeps us consistent with the authoritative order status instead of
  // trusting a possibly-stale in-memory copy. Without this, a refund that lands between
  // the status check and the earnings write would leave earnings that reverseEarningsForOrder
  // already ran on (and found nothing), so they'd be paid out at month end.
  if (D1_ENABLED) {
    try {
      const rows0 = await d1Query<{ status?: string }>(
        `SELECT json_extract(data,'$.status') AS status FROM orders WHERE order_id=?`,
        [order.order_id],
      );
      const live = rows0[0]?.status;
      if (live === "refunded" || live === "disputed") return;
    } catch {
      /* fall through to the in-memory check below */
    }
  }
  if (order.status === "refunded" || order.status === "disputed") return;

  const rows: EarningRecord[] = [];
  let created = 0;
  for (const [i, li] of (order.items ?? []).entries()) {
    if (!li.royalty_cents || li.royalty_cents <= 0 || !li.creator_id) continue;
    // M-11: 创作者自购自己的设计不产生 royalty —— 否则钱从左兜进右兜，平台白让出
    // 这部分 margin，还会污染创作者收益报表。
    if (li.creator_id === order.user_id) continue;
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
  // 内存层幂等：逐行判断（R2 修正——此前只要批次中任意一行已存在就整批跳过，会漏掉
  // 同批中确实缺失的其他行），与 D1 的 INSERT OR IGNORE 语义保持一致。
  const mem = earningsStore();
  for (const r of rows) {
    const dupe = [...mem.values()].some((v) => v.order_id === r.order_id && v.line_index === r.line_index);
    if (!dupe) mem.set(r.id, r);
  }
  if (!D1_ENABLED) return;
  try {
    // H-2: 不再「先 DELETE 再 INSERT」——该序列非原子，confirm 与 webhook 并发时
    // 两者都会越过 status 守卫并各写一份，月结时分成翻倍打款。现在依赖
    // UNIQUE(order_id, line_index)（见 db.ts ensureUniqueIndex）+ INSERT OR IGNORE：
    // 首次写入胜出，重复写入被数据库静默忽略，天然幂等且不会覆盖已 reversed 的退款行。
    for (const r of rows) {
      await d1Query(
        `INSERT OR IGNORE INTO creator_earnings (id, order_id, line_index, design_slug, creator_id, royalty_rate, net_cents, royalty_cents, status, created_at, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.order_id, r.line_index, r.design_slug, r.creator_id, r.royalty_rate, r.net_cents, r.royalty_cents, r.status, r.created_at, r.paid_at],
      );
    }
  } catch (e) {
    // H-9: 收益是钱。写入失败必须抛出让调用方告警，绝不能只打日志后当作成功。
    console.error("[db] recordOrderEarnings failed:", e instanceof Error ? e.message : e);
    throw e;
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
    if (r.status === "reversed") return; // refunded / clawed back — excluded from all totals
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
        if (r.status === "reversed") continue;
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
    return rows.map((r) => ({ ...r, status: r.status }));
  } catch (e) {
    console.error("[db] listEarningsForUser failed:", e instanceof Error ? e.message : e);
    return local;
  }
}

// ────────────────────────── M-UGC: 推荐分成（referral_earnings） ──────────────────────────

/**
 * 一笔订单行的推荐分成记录。当推荐人通过分享链接（dm_ref cookie）或注册记忆
 * （referred_by）带来一笔成交时，在支付成功后由 /api/payments/confirm 写入，
 * status 初始为 "pending"，月结时与创作者分成一起翻转（decision #6）。
 *
 * 推荐费率固定 7%（终身低费率，病毒系数高）。
 */
export const REFERRAL_RATE = 0.07;

/** P1: hard ceiling on referral commission paid to a single referrer per calendar month (cents). */
export const REFERRAL_MONTHLY_CAP_CENTS = 5000;

export type ReferralEarningRecord = {
  id: string;
  order_id: string;
  line_index: number;
  referrer_id: string;
  referred_user_id: string;
  source_design_slug: string;
  commission_rate: number;
  base_cents: number;
  commission_cents: number;
  status: "pending" | "paid" | "reversed";
  created_at: string;
  paid_at: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __dm_referral_earnings: Map<string, ReferralEarningRecord> | undefined;
}

export function referralEarningsStore(): Map<string, ReferralEarningRecord> {
  if (!globalThis.__dm_referral_earnings) globalThis.__dm_referral_earnings = new Map();
  return globalThis.__dm_referral_earnings;
}

/**
 * 把订单中带 referrer_id 的行写入 referral_earnings（status=pending）。幂等：同
 * order_id 先清后写。推荐人即带来成交者，被推荐人即下单买家；佣金基数取与该行
 * 创作者分成相同的 net_cents（与目的地/税费无关），commission = round(net × 0.07)。
 * 反自推（referrer == buyer 或 referrer == 该行设计 owner）已在下单时置空，
 * 这里再兜底一次。
 */
export async function recordReferralEarnings(order: OrderRecord): Promise<void> {
  if (!order.referrer_id) return;
  // M-10: same out-of-order-refund guard as recordOrderEarnings (see note there).
  if (D1_ENABLED) {
    try {
      const rows0 = await d1Query<{ status?: string }>(
        `SELECT json_extract(data,'$.status') AS status FROM orders WHERE order_id=?`,
        [order.order_id],
      );
      const live = rows0[0]?.status;
      if (live === "refunded" || live === "disputed") return;
    } catch {
      /* fall through to the in-memory check below */
    }
  }
  if (order.status === "refunded" || order.status === "disputed") return;
  // P1 (referral anti-fraud): only payout to email-verified referrers and cap the
  // total monthly commission, so an unlimited army of throwaway accounts can't farm
  // the 7% lifetime rate. Both checks are D1-backed; when D1 is off they degrade to
  // "allow" so local/dev flows still work.
  // H-14 (fail-closed): the referrer must be *proven* verified. Previously this
  // defaulted to true, so any D1 error — or D1 being disabled in production —
  // silently paid unverified referrers. Now: dev (no D1) allows, production requires
  // proof, and any lookup failure denies.
  let referrerVerified = !D1_ENABLED;
  let monthStartIso = "";
  if (D1_ENABLED) {
    try {
      const u = await d1Query<{ email_verified?: number }>(`SELECT email_verified FROM users WHERE id = ?`, [order.referrer_id]);
      referrerVerified = Boolean(u[0]?.email_verified);
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      monthStartIso = monthStart.toISOString();
    } catch (e) {
      // Fail closed: do not pay commission we cannot verify.
      referrerVerified = false;
      console.error("[db] recordReferralEarnings gate failed:", e instanceof Error ? e.message : e);
    }
  }
  if (!referrerVerified) return;
  const rows: ReferralEarningRecord[] = [];
  let created = 0;
  // Running total used only for the in-memory mirror; D1 enforces the cap in SQL.
  let memMonthCents = 0;
  for (const [i, li] of (order.items ?? []).entries()) {
    if (!li.referrer_id || !li.net_cents || li.net_cents <= 0) continue;
    // 兜底：推荐人不应是买家本人，也不应是该设计 owner（后者走创作者分成，不重复计推荐）。
    if (li.referrer_id === order.user_id) continue;
    if (li.creator_id && li.referrer_id === li.creator_id) continue;
    const commission = Math.round(li.net_cents * REFERRAL_RATE);
    if (commission <= 0) continue;
    // P1: monthly hard cap. For the in-memory mirror we approximate with a running
    // total; the authoritative check for D1 is embedded in the INSERT statement
    // below (H-14), which removes the read-then-write TOCTOU race that previously
    // let two concurrent orders both slip past the ceiling.
    if (memMonthCents >= REFERRAL_MONTHLY_CAP_CENTS) continue;
    memMonthCents += commission;
    const rec: ReferralEarningRecord = {
      id: newId("ref"),
      order_id: order.order_id,
      line_index: i,
      referrer_id: li.referrer_id,
      referred_user_id: order.user_id,
      source_design_slug: li.listing_slug || li.listing_id,
      commission_rate: REFERRAL_RATE,
      base_cents: li.net_cents,
      commission_cents: commission,
      status: "pending",
      created_at: new Date().toISOString(),
      paid_at: null,
    };
    rows.push(rec);
    created++;
  }
  if (created === 0) return;
  const refMem = referralEarningsStore();
  for (const r of rows) {
    const dupe = [...refMem.values()].some((v) => v.order_id === r.order_id && v.line_index === r.line_index);
    if (!dupe) refMem.set(r.id, r);
  }
  if (!D1_ENABLED) return;
  try {
    // H-2 + H-14: single atomic statement per line.
    //  - INSERT OR IGNORE + UNIQUE(order_id, line_index) replaces the old non-atomic
    //    DELETE-then-INSERT, so a concurrent confirm/webhook cannot double-pay.
    //  - The monthly cap check is embedded in the WHERE clause, so the read of the
    //    running total and the write happen inside one statement — no TOCTOU window.
    //  - `status != 'reversed'` stops refunded rows from consuming the referrer's quota.
    for (const r of rows) {
      await d1Query(
        `INSERT OR IGNORE INTO referral_earnings (id, order_id, line_index, referrer_id, referred_user_id, source_design_slug, commission_rate, base_cents, commission_cents, status, created_at, paid_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (
           SELECT COALESCE(SUM(commission_cents), 0) FROM referral_earnings
           WHERE referrer_id = ? AND created_at >= ? AND status != 'reversed'
         ) + ? <= ?`,
        [r.id, r.order_id, r.line_index, r.referrer_id, r.referred_user_id, r.source_design_slug, r.commission_rate, r.base_cents, r.commission_cents, r.status, r.created_at, r.paid_at,
         r.referrer_id, monthStartIso, r.commission_cents, REFERRAL_MONTHLY_CAP_CENTS],
      );
    }
  } catch (e) {
    // H-9: referral commission is money — surface the failure instead of swallowing it.
    console.error("[db] recordReferralEarnings failed:", e instanceof Error ? e.message : e);
    throw e;
  }
}

/**
 * P0-5: roll back pending creator + referral earnings for a refunded / disputed
 * order so they are never paid out. Set status='reversed' (the monthly settle only
 * flips 'pending'→'paid', so reversed rows are skipped by design). Idempotent.
 */
export async function reverseEarningsForOrder(orderId: string): Promise<{ reversed: number; alreadyPaid: number }> {
  const now = new Date().toISOString();
  const summary = { reversed: 0, alreadyPaid: 0 };
  for (const e of earningsStore().values()) {
    if (e.order_id === orderId && (e.status === "pending" || e.status === "paid")) {
      if (e.status === "paid") summary.alreadyPaid++;
      e.status = "reversed";
      e.paid_at = now;
      summary.reversed++;
    }
  }
  for (const e of referralEarningsStore().values()) {
    if (e.order_id === orderId && (e.status === "pending" || e.status === "paid")) {
      if (e.status === "paid") summary.alreadyPaid++;
      e.status = "reversed";
      e.paid_at = now;
      summary.reversed++;
    }
  }
  if (!D1_ENABLED) return summary;
  try {
    // H-3: previously this only touched 'pending', so once admin/settle had flipped a
    // row to 'paid' a later refund was silently ignored and the money was gone. We now
    // reverse paid rows too and report how many need manual recovery (clawback).
    for (const table of ["creator_earnings", "referral_earnings"]) {
      const paidRows = await d1Query<{ c?: number }>(
        `SELECT COUNT(*) AS c FROM ${table} WHERE order_id = ? AND status = 'paid'`,
        [orderId],
      );
      const paidCount = paidRows[0]?.c ?? 0;
      const changed = await d1Run(
        `UPDATE ${table} SET status='reversed', paid_at=? WHERE order_id=? AND status IN ('pending','paid')`,
        [now, orderId],
      );
      summary.reversed += changed;
      summary.alreadyPaid += paidCount;
    }
  } catch (e) {
    // H-9: a failed reversal means refunded orders may still be paid out at month end.
    console.error("[db] reverseEarningsForOrder failed:", e instanceof Error ? e.message : e);
    throw e;
  }
  return summary;
}

/** Find an order by its Stripe PaymentIntent id (D1-backed, in-memory fallback). Used by the refund webhook. */
export async function getOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRecord | undefined> {
  if (!paymentIntentId) return undefined;
  for (const o of ordersStore().values()) {
    if (o.payment?.payment_intent_id === paymentIntentId) return o;
  }
  if (!D1_ENABLED) return undefined;
  try {
    // R2: hit the indexed `payment_intent_id` column first (index seek). The JSON scan is
    // only a back-compat fallback for rows written before the column existed.
    let rows = await d1Query<{ data: string }>(
      `SELECT data FROM orders WHERE payment_intent_id = ? LIMIT 1`,
      [paymentIntentId],
    );
    if (rows.length === 0) {
      rows = await d1Query<{ data: string }>(
        `SELECT data FROM orders WHERE json_extract(data, '$.payment.payment_intent_id') = ? LIMIT 1`,
        [paymentIntentId],
      );
    }
    for (const r of rows) {
      try {
        const o = JSON.parse(r.data) as OrderRecord;
        if (o.payment?.payment_intent_id === paymentIntentId) return o;
      } catch {
        /* ignore malformed row */
      }
    }
  } catch (e) {
    console.error("[db] getOrderByPaymentIntent failed:", e instanceof Error ? e.message : e);
  }
  return undefined;
}

/** 读取某推荐人的推荐分成汇总（pending / paid / total），跨实例需回源 D1。 */
export async function getReferralEarningsForUser(userId: string): Promise<{
  pending_cents: number;
  paid_cents: number;
  total_cents: number;
  pending_count: number;
  paid_count: number;
}> {
  const acc = { pending_cents: 0, paid_cents: 0, total_cents: 0, pending_count: 0, paid_count: 0 };
  const tally = (r: ReferralEarningRecord) => {
    if (r.status === "reversed") return; // refunded / clawed back — excluded from all totals
    acc.total_cents += r.commission_cents;
    if (r.status === "pending") { acc.pending_cents += r.commission_cents; acc.pending_count++; }
    else { acc.paid_cents += r.commission_cents; acc.paid_count++; }
  };
  for (const r of referralEarningsStore().values()) if (r.referrer_id === userId) tally(r);
  if (D1_ENABLED) {
    try {
      const rows = await d1Query<{ status: string; commission_cents: number }>(
        `SELECT status, commission_cents FROM referral_earnings WHERE referrer_id = ?`,
        [userId],
      );
      const reset = { pending_cents: 0, paid_cents: 0, total_cents: 0, pending_count: 0, paid_count: 0 };
      for (const r of rows) {
        if (r.status === "reversed") continue;
        const c = r.commission_cents ?? 0;
        reset.total_cents += c;
        if (r.status === "paid") { reset.paid_cents += c; reset.paid_count++; }
        else { reset.pending_cents += c; reset.pending_count++; }
      }
      return reset;
    } catch (e) {
      console.error("[db] getReferralEarningsForUser failed:", e instanceof Error ? e.message : e);
    }
  }
  return acc;
}

/** 推荐人分成明细（最近 N 条），D1 为权威。 */
export async function listReferralEarningsForUser(userId: string, limit = 25): Promise<ReferralEarningRecord[]> {
  const local = Array.from(referralEarningsStore().values())
    .filter((e) => e.referrer_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
  if (!D1_ENABLED) return local;
  try {
    const rows = await d1Query<ReferralEarningRecord>(
      `SELECT id, order_id, line_index, referrer_id, referred_user_id, source_design_slug, commission_rate, base_cents, commission_cents, status, created_at, paid_at
         FROM referral_earnings WHERE referrer_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit],
    );
    return rows.map((r) => ({ ...r, status: r.status }));
  } catch (e) {
    console.error("[db] listReferralEarningsForUser failed:", e instanceof Error ? e.message : e);
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
