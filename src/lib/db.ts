// D1 persistence layer (HTTP API) for the Desmake custom Node server.
//
// The container runs a plain Node process, so it cannot use D1 bindings directly;
// it talks to the D1 REST API instead. Credentials are injected as environment
// variables by worker.mjs (envVars) from Worker vars/secrets.
//
// Node runtime only — do NOT add `export const runtime = "edge"` to any route that
// imports this module.

export const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5";
// Guard against the value being the literal string "undefined" — that happens when
// the Worker secret D1_DATABASE_ID is unset and `worker.mjs` forwards `env.D1_DATABASE_ID`
// (a JS undefined) into the container's process.env as the string "undefined". Treat it
// as empty so D1 stays disabled rather than sending an invalid databaseId to the API.
const _rawDbId = process.env.D1_DATABASE_ID;
export const D1_DATABASE_ID = _rawDbId && _rawDbId !== "undefined" ? _rawDbId : "";
export const D1_API_TOKEN = process.env.D1_CF_API_TOKEN || "";

export const D1_ENABLED = Boolean(D1_DATABASE_ID && D1_API_TOKEN);

/**
 * Run a single SQL statement against D1 and return the row results.
 * Throws when D1 is not configured or the request fails — callers decide whether
 * that is fatal (auth) or just skippable (best-effort persistence).
 */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!D1_ENABLED) throw new Error("D1 not configured");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${D1_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: Array<{ results?: T[]; success?: boolean; meta?: { rows_written?: number } }>;
  };
  if (!res.ok || body.success !== true) {
    const msg = body.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`D1 query failed: ${msg}`);
  }
  return (body.result?.[0]?.results ?? []) as T[];
}

/** Idempotent schema bootstrap. Called once at server start.
 *
 * RESILIENCE (#secops): every statement is guarded independently. A single
 * failure (e.g. a transient D1 error, or a statement that was already applied
 * by another warm container in the max_instances=3 pool) must NOT abort the
 * remaining statements — otherwise a partial failure leaves the schema in an
 * inconsistent state across container restarts (this is exactly what caused
 * `email_verifications` + the `email_verified` column to be silently skipped
 * on an earlier deploy).
 */
async function ensureOne(label: string, sql: string): Promise<boolean> {
  try {
    await d1Query(sql);
    console.log(`[db] ensureSchema: ${label} ok`);
    return true;
  } catch (e) {
    console.error(`[db] ensureSchema: ${label} FAILED:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export async function ensureSchema(): Promise<void> {
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
  // Older databases lack the email_verified column — add it idempotently.
  // Guarded inside ensureOne too, so a "duplicate column" error is logged, not fatal.
  await ensureOne(
    "users.email_verified column",
    `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
  );
  // M3: creator earnings ledger. Written when an order is paid; settled (pending→paid)
  // monthly by manual payout. Idempotent so re-running bootstrap is safe.
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
}
