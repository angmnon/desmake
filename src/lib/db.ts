// D1 persistence layer for the Desmake app (Cloudflare Workers, B1 migration).
//
// B1 migration: D1 is now a NATIVE Cloudflare binding (`DB` in wrangler.jsonc),
// accessed via getCloudflareContext().env.DB — NOT the D1 REST API. This removes
// the per-query outbound HTTP call and the need for a CF API token. The binding is
// available inside the Workers runtime and in local dev via `wrangler dev` (which
// reads the bindings declared in wrangler.jsonc).
//
// Node runtime only — do NOT add `export const runtime = "edge"` to any route that
// imports this module (OpenNext runs the Node.js runtime, which is what we want).

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Native binding is now mandatory (no REST fallback). Kept as an exported constant
// so the ~20 existing `if (!D1_ENABLED)` guards keep compiling unchanged.
export const D1_ENABLED = true;

function getDB(): any {
  const env = (getCloudflareContext() as any)?.env ?? {};
  const db = env.DB;
  if (!db) throw new Error("D1 binding (DB) is not configured");
  return db;
}

/** Run a statement directly against the binding (used by schema bootstrap). */
async function rawRun(sql: string, params: unknown[] = []): Promise<void> {
  const db = getDB();
  const stmt = db.prepare(sql);
  // IMPORTANT: in workerd's D1, `bind()` returns a NEW bound statement object.
  // The original `stmt` is left unbound, so we MUST use the returned reference.
  const bound = params.length ? stmt.bind(...params) : stmt;
  await bound.run();
}

/** Raw SELECT against the binding, bypassing ensureSchema (used by PRAGMA probes). */
async function rawAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = getDB();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all();
  return (res.results ?? []) as T[];
}

let schemaReady: Promise<void> | null = null;
/** Idempotent schema bootstrap, memoized per isolate (replaces server.ts boot step). */
function ensureSchemaOnce(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((e) => {
      schemaReady = null; // allow a later retry if the first attempt failed
      throw e;
    });
  }
  return schemaReady;
}

/**
 * Run a single SQL statement against D1 and return the row results.
 * Throws when the D1 binding is not configured or the request fails — callers
 * decide whether that is fatal (auth) or skippable (best-effort persistence).
 */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchemaOnce();
  const db = getDB();
  const stmt = db.prepare(sql);
  // workerd D1: `bind()` returns a NEW bound statement — must use its return value.
  const bound = params.length ? stmt.bind(...params) : stmt;
  // D1's `all()`/`first()`/`raw()` are for READ queries only. Calling `all()` on a
  // write statement (INSERT/UPDATE/DELETE) throws "Wrong number of parameter bindings"
  // in the native Workers binding. Route writes through `run()` and reads through `all()`.
  const head = sql.trim().toUpperCase();
  const isRead = head.startsWith("SELECT") || head.startsWith("PRAGMA") || head.startsWith("WITH");
  if (isRead) {
    const res = await bound.all();
    return (res.results ?? []) as T[];
  }
  await bound.run();
  return [] as T[];
}

/**
 * Run a write statement (INSERT/UPDATE/DELETE) and return the number of rows
 * changed. Use this when the caller needs the change count (e.g. reverseEarnings
 * accounting) — `d1Query` returns `[]` for writes to keep its read contract.
 */
export async function d1Run(sql: string, params: unknown[] = []): Promise<number> {
  await ensureSchemaOnce();
  const db = getDB();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return (res.meta?.changes ?? 0) as number;
}

/**
 * Schema statements that failed on this isolate. Exposed via /api/health so a
 * half-built schema is visible instead of silently degrading (M-4). Previously
 * every failure was only console.error'd, which meant a missing table produced
 * empty results that looked like "no data" rather than an outage.
 */
const schemaFailures: string[] = [];
export function getSchemaFailures(): string[] {
  return [...schemaFailures];
}

/**
 * Run one DDL/DML statement idempotently. Every statement is guarded independently
 * so a single transient failure does not abort the remaining bootstrap (this is
 * exactly what caused `email_verifications` + `email_verified` to be silently
 * skipped on an earlier deploy).
 */
async function ensureOne(label: string, sql: string): Promise<boolean> {
  try {
    await rawRun(sql);
    console.log(`[db] ensureSchema: ${label} ok`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[db] ensureSchema: ${label} FAILED:`, msg);
    if (!schemaFailures.includes(label)) schemaFailures.push(label);
    return false;
  }
}

/**
 * Add a column only if it is missing.
 *
 * M-4: the previous code issued 13 unconditional `ALTER TABLE users ADD COLUMN`
 * statements on every cold start. SQLite raises "duplicate column name" once the
 * column exists, which was swallowed and logged as FAILED — so every boot printed
 * ~13 fake errors that buried any *real* schema failure. Probing first makes the
 * bootstrap genuinely idempotent and the logs meaningful.
 */
async function ensureColumn(table: string, column: string, ddl: string): Promise<boolean> {
  const label = `${table}.${column} column`;
  try {
    const cols = await rawAll<{ name: string }>(`PRAGMA table_info(${table})`);
    if (cols.some((c) => c.name === column)) return true;
    return await ensureOne(label, ddl);
  } catch {
    // PRAGMA failed (table may not exist yet) — fall back to attempting the ALTER.
    return await ensureOne(label, ddl);
  }
}

/**
 * Create a UNIQUE index, first collapsing any pre-existing duplicate rows.
 *
 * H-2: creator/referral earnings had no uniqueness on order_id, so a concurrent
 * confirm + webhook could each write a row and double-pay the creator at month
 * end. `CREATE UNIQUE INDEX` fails outright if duplicates already exist, and that
 * failure would be swallowed — so dedupe first (keep the lowest rowid per key).
 */
async function ensureUniqueIndex(
  label: string,
  table: string,
  indexName: string,
  columns: string[],
): Promise<boolean> {
  const cols = columns.join(", ");
  await ensureOne(
    `${label} dedupe`,
    `DELETE FROM ${table} WHERE rowid NOT IN (SELECT MIN(rowid) FROM ${table} GROUP BY ${cols})`,
  );
  return await ensureOne(label, `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} (${cols})`);
}

/** Idempotent schema bootstrap. Called once per isolate (via ensureSchemaOnce). */
async function ensureSchema(): Promise<void> {
  await ensureOne(
    "users",
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    )`,
  );
  await ensureOne(
    "sessions",
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
  await ensureOne(
    "orders",
    `CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )`,
  );
  await ensureOne(
    "designs",
    `CREATE TABLE IF NOT EXISTS designs (
      slug TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )`,
  );
  // P0-1: shared design-index version counter (cross-instance cache invalidation).
  await ensureOne(
    "catalog_meta",
    `CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    )`,
  );
  await ensureOne(
    "generation_jobs",
    `CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )`,
  );
  await ensureOne(
    "email_verifications",
    `CREATE TABLE IF NOT EXISTS email_verifications (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
  // M-4: idempotent column additions — probed via PRAGMA so re-runs are silent
  // instead of logging "duplicate column name" as a fake failure.
  await ensureColumn("users", "email_verified", `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn("users", "handle", `ALTER TABLE users ADD COLUMN handle TEXT`);
  await ensureColumn("users", "bio", `ALTER TABLE users ADD COLUMN bio TEXT`);
  await ensureColumn("users", "avatar_seed", `ALTER TABLE users ADD COLUMN avatar_seed TEXT`);
  await ensureColumn("users", "city", `ALTER TABLE users ADD COLUMN city TEXT`);
  await ensureColumn("users", "role_tag", `ALTER TABLE users ADD COLUMN role_tag TEXT`);
  await ensureColumn("users", "verified", `ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn("users", "referred_by", `ALTER TABLE users ADD COLUMN referred_by TEXT`);
  await ensureColumn("users", "acquisition_source", `ALTER TABLE users ADD COLUMN acquisition_source TEXT`);
  await ensureColumn("users", "acquisition_medium", `ALTER TABLE users ADD COLUMN acquisition_medium TEXT`);
  await ensureColumn("users", "acquisition_campaign", `ALTER TABLE users ADD COLUMN acquisition_campaign TEXT`);
  await ensureColumn("users", "acquisition_gclid", `ALTER TABLE users ADD COLUMN acquisition_gclid TEXT`);
  await ensureColumn("users", "acquisition_fbclid", `ALTER TABLE users ADD COLUMN acquisition_fbclid TEXT`);
  await ensureColumn("users", "acquisition_landing", `ALTER TABLE users ADD COLUMN acquisition_landing TEXT`);
  // H-7: session epoch — bumped on logout/password change to invalidate stateless tokens.
  await ensureColumn("users", "session_epoch", `ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0`);
  // H-10: per-user AI generation quota counters.
  await ensureColumn("users", "gen_used_month", `ALTER TABLE users ADD COLUMN gen_used_month INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn("users", "gen_month", `ALTER TABLE users ADD COLUMN gen_month TEXT`);
  await ensureOne(
    "users.handle unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle)`,
  );
  await ensureOne(
    "creator_earnings",
    `CREATE TABLE IF NOT EXISTS creator_earnings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      line_index INTEGER NOT NULL,
      design_slug TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      royalty_rate REAL NOT NULL,
      net_cents INTEGER NOT NULL,
      royalty_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT
    )`,
  );
  await ensureOne(
    "creator_earnings indexes",
    `CREATE INDEX IF NOT EXISTS idx_earnings_creator ON creator_earnings (creator_id)`,
  );
  // H-2: one earnings row per order line, enforced by the database. Combined with
  // INSERT OR IGNORE this makes concurrent confirm/webhook writes idempotent and
  // stops month-end settlement from paying the same royalty twice.
  await ensureUniqueIndex(
    "creator_earnings unique order+line",
    "creator_earnings",
    "idx_earnings_order_line",
    ["order_id", "line_index"],
  );
  await ensureOne(
    "referral_earnings",
    `CREATE TABLE IF NOT EXISTS referral_earnings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      line_index INTEGER NOT NULL,
      referrer_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      source_design_slug TEXT NOT NULL,
      commission_rate REAL NOT NULL,
      base_cents INTEGER NOT NULL,
      commission_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT
    )`,
  );
  await ensureOne(
    "referral_earnings indexes",
    `CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_earnings (referrer_id)`,
  );
  // H-2: see creator_earnings above — same double-payment risk for referrals.
  await ensureUniqueIndex(
    "referral_earnings unique order+line",
    "referral_earnings",
    "idx_referral_order_line",
    ["order_id", "line_index"],
  );
  await ensureOne(
    "design_events",
    `CREATE TABLE IF NOT EXISTS design_events (
      id TEXT PRIMARY KEY,
      design_slug TEXT NOT NULL,
      event TEXT NOT NULL,
      ip_hash TEXT,
      referrer_handle TEXT,
      ts TEXT NOT NULL
    )`,
  );
  await ensureOne(
    "design_events indexes",
    `CREATE INDEX IF NOT EXISTS idx_design_events_slug ON design_events (design_slug)`,
  );
  await ensureOne(
    "cms_posts",
    `CREATE TABLE IF NOT EXISTS cms_posts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      body_md TEXT NOT NULL,
      cover_image TEXT,
      author TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      published_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  );
  await ensureOne(
    "cms_posts unique type+slug",
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_posts_type_slug ON cms_posts(type, slug)`,
  );
  await ensureOne(
    "cms_posts published idx",
    `CREATE INDEX IF NOT EXISTS idx_cms_posts_published ON cms_posts(status, published_at)`,
  );
}
