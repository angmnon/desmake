// D1 persistence layer (HTTP API) for the Desmake custom Node server.
//
// The container runs a plain Node process, so it cannot use D1 bindings directly;
// it talks to the D1 REST API instead. Credentials are injected as environment
// variables by worker.mjs (envVars) from Worker vars/secrets.
//
// Node runtime only — do NOT add `export const runtime = "edge"` to any route that
// imports this module.

export const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5";
export const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "";
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

/** Idempotent schema bootstrap. Called once at server start. */
export async function ensureSchema(): Promise<void> {
  await d1Query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    )
  `);
  await d1Query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await d1Query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )
  `);
  await d1Query(`
    CREATE TABLE IF NOT EXISTS designs (
      slug TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )
  `);
  await d1Query(`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_ts INTEGER NOT NULL
    )
  `);
}
