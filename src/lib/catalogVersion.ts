// Tiny module holding the design-index cache version. Lives separately from
// stores.ts and catalogIndex.ts so neither has to import the other (avoids a
// circular dependency: stores -> catalogIndex -> stores).
//
// The cached design index (built once per process from a D1 scan) is invalidated
// by bumping this version. Any write that changes the published-design set
// (publish / backfill) calls `bumpDesignIndex()` so the next read rebuilds.
//
// P0-1 FIX (2026-08-18): the version is now stored in D1 (`catalog_meta` table)
// so it is shared across ALL container instances (max_instances=3). Previously it
// was a module-level `let version = 0` per process, so a publish on instance A
// bumped only A's counter; B/C kept their cached index (built at their own v0)
// and never saw the new design until a cold restart. Now `getDesignIndexVersion`
// reads the shared counter (with a short in-process mirror/TTL to avoid a D1 read
// on every request) and `bumpDesignIndex` atomically increments the shared row,
// so every instance rebuilds its index on the next read after a publish.

import { d1Query, D1_ENABLED } from "@/lib/db";

const VERSION_KEY = "design_index_version";

// In-process mirror of the shared version + refresh timestamp. Used to avoid a D1
// round-trip on every catalog read while still picking up bumps quickly.
let localMirror: number | null = null;
let lastRead = 0;
const TTL_MS = 1000;

async function readSharedVersion(): Promise<number> {
  try {
    const rows = await d1Query<{ value: number | string }>(
      `SELECT value FROM catalog_meta WHERE key = ?`,
      [VERSION_KEY],
    );
    if (rows.length === 0) return 0;
    const v = Number(rows[0].value);
    return Number.isFinite(v) ? v : 0;
  } catch {
    // Missing table / transient error — treat as 0 rather than throwing.
    return 0;
  }
}

export async function getDesignIndexVersion(): Promise<number> {
  if (!D1_ENABLED) return localMirror ?? 0;
  const now = Date.now();
  if (localMirror !== null && now - lastRead < TTL_MS) return localMirror;
  localMirror = await readSharedVersion();
  lastRead = now;
  return localMirror ?? 0;
}

export async function bumpDesignIndex(): Promise<void> {
  if (!D1_ENABLED) {
    localMirror = (localMirror ?? 0) + 1;
    return;
  }
  try {
    // Atomic increment via UPSERT so concurrent publishes across instances
    // can't clobber each other's bump.
    await d1Query(
      `INSERT INTO catalog_meta (key, value) VALUES (?, 1)
       ON CONFLICT(key) DO UPDATE SET value = value + 1`,
      [VERSION_KEY],
    );
    localMirror = await readSharedVersion();
    lastRead = Date.now();
  } catch (e) {
    console.error("[db] bumpDesignIndex failed:", e instanceof Error ? e.message : e);
  }
}
