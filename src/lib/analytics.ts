// Server-side creator analytics for the Desmake dashboard.
//
// Aggregates behavioral events (view / save / share) recorded per published design
// and the creator's earnings ledgers into the shapes the dashboard expects:
//   creatorAnalytics(userId)  -> Overview  { works, views, saves, shares, referred_visits, creator_earnings, referral_earnings }
//   perDesignAnalytics(userId) -> PerDesign[] { slug, title, views, saves, shares }
//
// D1 is the source of truth (cross-instance safe); an in-memory event mirror is
// kept only as a fallback when D1 is disabled.

import { d1Query, D1_ENABLED } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newId } from "@/lib/stores";
import { publishedDesignsByUser } from "@/lib/creators";
import { getEarningsForUser, getReferralEarningsForUser } from "@/lib/stores";
import { createHash } from "node:crypto";

export type DesignEventKind = "view" | "save" | "share";

type DesignEventRow = {
  id: string;
  design_slug: string;
  event: string;
  ip_hash: string | null;
  referrer_handle: string | null;
  ts: string;
};

// In-memory mirror — warm fallback only when D1 is unavailable. Bounded so a
// long-lived instance can't grow it without limit.
const events: DesignEventRow[] = [];
const MAX_MIRROR = 5000;

// P2-4: batch D1 writes. Appending one row per behavioral event would issue a
// separate INSERT for every page view; instead we buffer events and flush them in
// a single multi-row INSERT once the buffer reaches FLUSH_AT, or drain a low-traffic
// trickle after the response via the Workers execution context's waitUntil.
const FLUSH_AT = 50;
let pending: DesignEventRow[] = [];

// Workers have no long-lived timers (setInterval/unref are Node concepts). Instead
// of a background flush timer, we flush on threshold, and for slow trickles we
// drain after the response using ctx.waitUntil (the idiomatic Worker replacement).
function scheduleFlush() {
  if (pending.length === 0) return;
  if (pending.length >= FLUSH_AT) {
    void flushEvents();
    return;
  }
  try {
    const ctx = (getCloudflareContext() as any)?.ctx;
    if (ctx?.waitUntil) ctx.waitUntil(flushEvents());
  } catch {
    /* best-effort; the next event will retry the drain */
  }
}

async function flushEvents(): Promise<void> {
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  if (!D1_ENABLED) return;
  try {
    const ph = batch.map(() => "(?,?,?,?,?,?)").join(",");
    const params: unknown[] = [];
    for (const r of batch) {
      params.push(r.id, r.design_slug, r.event, r.ip_hash, r.referrer_handle, r.ts);
    }
    await d1Query(
      `INSERT INTO design_events (id, design_slug, event, ip_hash, referrer_handle, ts) VALUES ${ph}`,
      params,
    );
  } catch (e) {
    console.error("[analytics] flushEvents D1 failed:", e instanceof Error ? e.message : e);
    // Re-queue (bounded) so a transient D1 error doesn't silently drop events.
    if (pending.length < 10000) pending = batch.concat(pending);
  }
}

/** Stable, non-reversible hash of a client IP for privacy-safe event attribution. */
export function hashIp(ip: string | null): string {
  if (!ip) return "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Record a behavioral event against a published design (fire-and-forget safe). */
export async function recordDesignEvent(
  slug: string,
  event: DesignEventKind,
  opts: { ipHash: string; referrerHandle: string | null },
): Promise<void> {
  const row: DesignEventRow = {
    id: newId("evt"),
    design_slug: slug,
    event,
    ip_hash: opts.ipHash,
    referrer_handle: opts.referrerHandle,
    ts: new Date().toISOString(),
  };
  // Keep the in-memory mirror bounded for the D1-disabled fallback path.
  events.push(row);
  if (events.length > MAX_MIRROR) events.splice(0, events.length - MAX_MIRROR);
  // P2-4: buffer for batched D1 flush instead of one INSERT per event.
  pending.push(row);
  scheduleFlush();
}

/** Overview metrics for the creator dashboard. */
export async function creatorAnalytics(userId: string) {
  const designs = await publishedDesignsByUser(userId);
  const slugs = designs.map((d) => d.slug);
  let views = 0;
  let saves = 0;
  let shares = 0;
  let referredVisits = 0;

  if (D1_ENABLED && slugs.length) {
    const ph = slugs.map(() => "?").join(",");
    const rows = await d1Query<{ event: string; cnt: number; referred: number | null }>(
      `SELECT event, COUNT(*) AS cnt, SUM(CASE WHEN referrer_handle IS NOT NULL THEN 1 ELSE 0 END) AS referred
       FROM design_events WHERE design_slug IN (${ph}) GROUP BY event`,
      slugs,
    );
    for (const r of rows) {
      if (r.event === "view") {
        views = r.cnt;
        referredVisits += Number(r.referred ?? 0);
      } else if (r.event === "save") saves = r.cnt;
      else if (r.event === "share") shares = r.cnt;
    }
  } else {
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (slugs.includes(e.design_slug)) counts[e.event] = (counts[e.event] ?? 0) + 1;
    }
    views = counts["view"] ?? 0;
    saves = counts["save"] ?? 0;
    shares = counts["share"] ?? 0;
    referredVisits = events.filter((e) => slugs.includes(e.design_slug) && e.referrer_handle).length;
  }

  const cEarn = await getEarningsForUser(userId);
  const rEarn = await getReferralEarningsForUser(userId);

  return {
    works: designs.length,
    views,
    saves,
    shares,
    referred_visits: referredVisits,
    creator_earnings: {
      pending_cents: cEarn.pending_cents,
      paid_cents: cEarn.paid_cents,
      total_cents: cEarn.total_cents,
    },
    referral_earnings: {
      pending_cents: rEarn.pending_cents,
      paid_cents: rEarn.paid_cents,
      total_cents: rEarn.total_cents,
    },
  };
}

/** Per-design view / save / share breakdowns for the dashboard table. */
export async function perDesignAnalytics(userId: string) {
  const designs = await publishedDesignsByUser(userId);
  const out: Array<{ slug: string; title: string; views: number; saves: number; shares: number }> = [];

  for (const d of designs) {
    let views = 0;
    let saves = 0;
    let shares = 0;
    if (D1_ENABLED) {
      const rows = await d1Query<{ event: string; cnt: number }>(
        `SELECT event, COUNT(*) AS cnt FROM design_events WHERE design_slug = ? GROUP BY event`,
        [d.slug],
      );
      for (const r of rows) {
        if (r.event === "view") views = r.cnt;
        else if (r.event === "save") saves = r.cnt;
        else if (r.event === "share") shares = r.cnt;
      }
    } else {
      for (const e of events) {
        if (e.design_slug !== d.slug) continue;
        if (e.event === "view") views++;
        else if (e.event === "save") saves++;
        else if (e.event === "share") shares++;
      }
    }
    out.push({ slug: d.slug, title: d.title ?? d.slug, views, saves, shares });
  }
  return out;
}
