// Client-side analytics + first-party attribution helpers for Desmake.
//
// Two independent concerns, both consent-gated:
//   1. Third-party tracking (GA4 / Meta Pixel / Google Ads). The `track()`
//      function only fires when the visitor has granted consent (see consent.ts)
//      and after the analytics scripts have loaded (see the `Analytics`
//      component). Early events are buffered and flushed on ready.
//   2. First-party attribution capture (UTM / gclid / fbclid / ref). Stored in a
//      same-site `dm_attrib` cookie so we can attribute sign-ups and orders to the
//      campaign that drove them.
//
// R2-M-6: attribution capture is ALSO gated on consent. The dm_attrib cookie is a
// persistent (90-day) identifier used for marketing attribution, so under
// ePrivacy/GDPR it needs consent just like the third-party pixels. Note the
// *functional* referral cookie `dm_ref` (set server-side by /api/ref) and the
// `?ref=` signup param are separate and unaffected — paying creators their
// referral commission does not depend on marketing consent.
//
// This module is imported by both client components and server routes (only the
// `readAttributionFromRequest` export is used server-side; all window/document
// access is inside functions guarded by `typeof window/document === "undefined"`.

import { readConsent } from "./consent";

export type EventParams = Record<string, unknown>;

// Meta Pixel expects capitalized standard event names.
const META_EVENTS: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};

type DmEvent = { name: string; params: EventParams };
const buffer: DmEvent[] = [];

function isReady(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__dmAnalyticsReady);
}

function dispatch(name: string, params: EventParams): void {
  const w = window as any;
  try {
    if (typeof w.gtag === "function") w.gtag("event", name, params);
  } catch {
    /* analytics must never throw */
  }
  try {
    const meta = META_EVENTS[name];
    if (meta && typeof w.fbq === "function") w.fbq("track", meta, params);
  } catch {
    /* analytics must never throw */
  }
}

function flush(): void {
  if (!isReady()) return;
  while (buffer.length) {
    const e = buffer.shift()!;
    dispatch(e.name, e.params);
  }
}

/** Called by the Analytics component once the third-party scripts are live. */
export function markAnalyticsReady(): void {
  if (typeof window === "undefined") return;
  (window as any).__dmAnalyticsReady = true;
  flush();
}

/**
 * Track a standard ecommerce/analytics event. No-op unless consent is granted
 * and analytics scripts are loaded. Events fired before the scripts finish
 * loading are buffered and replayed once ready.
 */
export function track(name: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  if (readConsent() !== "granted") return;
  if (isReady()) dispatch(name, params);
  else buffer.push({ name, params });
  // Best-effort replay on a later tick in case scripts finish a moment later.
  if (!isReady()) setTimeout(flush, 0);
}

// ─────────────────────────── attribution capture ───────────────────────────

const ATTRIB_COOKIE = "dm_attrib";
const ATTRIB_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "ref",
  "mc_cid",
  "mc_eid",
];

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  ref?: string;
  landing_path?: string;
  ts?: number;
};

/**
 * Capture UTM / click-id params from the URL into a first-party cookie.
 *
 * R2-M-6: no-op unless the visitor has granted consent — this cookie is a
 * persistent marketing identifier, so writing it before consent violates
 * ePrivacy/GDPR. Called again when consent flips to "granted" so a visitor who
 * accepts a moment after landing still has their landing params captured.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (readConsent() !== "granted") return;
  const params = new URLSearchParams(window.location.search);
  const data: Record<string, string> = {};
  let has = false;
  for (const k of ATTRIB_PARAMS) {
    const v = params.get(k);
    if (v) {
      data[k] = v;
      has = true;
    }
  }
  if (!has) return;
  const existing = readAttribution();
  const merged: Attribution = {
    ...existing,
    ...data,
    landing_path: window.location.pathname,
    ts: Date.now(),
  };
  const encoded = encodeURIComponent(JSON.stringify(merged));
  document.cookie = `${ATTRIB_COOKIE}=${encoded}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
}

/** Read the first-party attribution cookie from the browser. */
export function readAttribution(): Attribution {
  if (typeof document === "undefined") return {};
  const c = document.cookie
    .split("; ")
    .find((x) => x.startsWith(ATTRIB_COOKIE + "="));
  if (!c) return {};
  try {
    return JSON.parse(decodeURIComponent(c.split("=").slice(1).join("="))) as Attribution;
  } catch {
    return {};
  }
}

/** Read the first-party attribution cookie from a server Request. */
export function readAttributionFromRequest(req: Request): Attribution {
  const c = req
    .headers
    .get("cookie")
    ?.split("; ")
    .find((x) => x.startsWith(ATTRIB_COOKIE + "="));
  if (!c) return {};
  try {
    return JSON.parse(decodeURIComponent(c.split("=").slice(1).join("="))) as Attribution;
  } catch {
    return {};
  }
}
