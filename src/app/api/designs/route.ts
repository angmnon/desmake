import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { designsStore, listDesignsForUserAsync, newId, persistDesign, DEFAULT_PALETTE, type PublishedDesign } from "@/lib/stores";
import { getSessionAsync, SESSION_COOKIE, getUserById } from "@/lib/session";
import { uploadToR2, R2_ENABLED } from "@/lib/r2";
import { rateLimit } from "@/lib/ratelimit";
import { ADAPTERS, DESIGNS, CATEGORIES, adapterDefaultSku, adapterIdForSku, type SelectedProduct } from "@/lib/data";
import { SKU_BY_ID } from "@/lib/pricing";

// No edge runtime — the designs store lives on `globalThis` (R2/C1).

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const MAX_TITLE = 80;
const DEFAULT_ADAPTERS = ["poster", "tshirt", "sticker"];

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "design";
}

function isPalette(v: unknown): v is [string, string, string] {
  return Array.isArray(v) && v.length === 3 && v.every((c) => typeof c === "string" && HEX_RE.test(c));
}

const ALLOWED_CT = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024; // 4MB, matches /api/upload

/**
 * H-4a (SSRF): hosts this endpoint is willing to fetch an image from.
 *
 * Previously ANY client-supplied http(s) URL was fetched server-side and its bytes
 * written to R2 with a content-type taken from the attacker-controlled response
 * headers. That turned publish into a general-purpose, readable SSRF proxy.
 *
 * Only the configured AI provider(s) and our own origin are fetched now. If your
 * provider serves rasters from a separate CDN, add it via `AI_IMAGE_HOSTS`
 * (comma-separated hostnames); anything else falls back to the procedural Artwork
 * placeholder rather than being fetched.
 */
function allowedImageHosts(): Set<string> {
  const hosts = new Set<string>();
  const push = (raw?: string | null) => {
    if (!raw) return;
    try {
      hosts.add(new URL(raw).host.toLowerCase());
    } catch {
      /* ignore unparseable */
    }
  };
  push(process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1");
  push(process.env.OPENAI_BASE_URL || "https://api.openai.com");
  push(process.env.SITE_URL);
  push(process.env.R2_PUBLIC_BASE_URL);
  for (const h of (process.env.AI_IMAGE_HOSTS || "").split(",")) {
    const t = h.trim().toLowerCase();
    if (t) hosts.add(t);
  }
  return hosts;
}

/**
 * H-4b: an uploaded design's image must be a same-origin `/cdn/...` path — the shape
 * `/api/upload` returns. Previously `body.imageUrl` was stored verbatim (any absolute
 * URL up to 6000 chars), and because the custom image loader rewrites a non-relative
 * src into `/cdn-cgi/image/<opts>/<absolute-url>`, Cloudflare Image Resizing would
 * then fetch that URL server-side on every render. That is a stored SSRF / open image
 * proxy reachable by any logged-in user. Reject anything that is not ours.
 */
function isSameOriginCdnPath(raw: string): boolean {
  if (raw.startsWith("/cdn/")) return true;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const site = new URL(process.env.SITE_URL || "https://desmake.com");
    if (u.host.toLowerCase() !== site.host.toLowerCase()) return false;
    // Canonical storage is the raw /cdn/<key> path; the loader adds /cdn-cgi at render.
    const p = u.pathname.replace(/^\/cdn-cgi\/image\/[^/]+\//, "/");
    return p.startsWith("/cdn/");
  } catch {
    return false;
  }
}

/**
 * D5-Low: reject IP-literal hosts that point at private / link-local / loopback
 * ranges (including the cloud metadata endpoint 169.254.169.254). The host
 * allowlist already excludes these in practice, but defending in depth here
 * means a future allowlist entry (or a DNS-rebinding name) cannot turn the
 * server-side fetch into an internal-network probe.
 */
function isPrivateOrMetadataHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;

  // IPv4 literal?
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true; // 10/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6 literal? Reject loopback, unique-local (fc00::/7) and link-local (fe80::/10).
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(h)) return true;
    return false;
  }
  return false;
}

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.host.toLowerCase();
    if (isPrivateOrMetadataHost(host)) return false;
    return allowedImageHosts().has(host);
  } catch {
    return false;
  }
}

/**
 * Resolve a generated image into a durable, same-origin URL we can render.
 * AI designs previously stored no image at all and fell back to a procedural
 * placeholder; now we re-host the Agnes raster on R2 so the marketplace shows
 * the actual generated art. Accepts either a data URL or an http(s) URL.
 * Returns undefined (→ Artwork fallback) when R2 is unavailable and the source
 * is not a storable http(s) URL, or on any failure.
 */
async function resolveAiImage(raw: unknown): Promise<string | undefined> {
  if (typeof raw !== "string" || !raw) return undefined;

  const dataMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (dataMatch) {
    if (!R2_ENABLED) return undefined; // too large to store inline in D1
    const ct = dataMatch[1];
    if (!ALLOWED_CT.has(ct)) return undefined;
    const buf = Buffer.from(dataMatch[2], "base64");
    if (buf.length > MAX_BYTES) return undefined;
    const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
    const key = `ai/${newId("img")}.${ext}`;
    try {
      return await uploadToR2(key, buf, ct);
    } catch {
      return undefined;
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    const url = raw.slice(0, 4000);
    // H-4a: refuse to fetch anything that is not the AI provider or our own origin.
    if (!isAllowedImageUrl(url)) {
      console.warn("[designs] rejected non-allowlisted image host — refusing to fetch");
      return undefined;
    }
    if (R2_ENABLED) {
      try {
        // redirect:"manual" — a 302 to an unvalidated host must not be followed,
        // otherwise the allowlist above could be bypassed by an open redirector.
        const res = await fetch(url, { redirect: "manual" });
        if (res.ok) {
          const ct = res.headers.get("content-type") || "image/png";
          if (ALLOWED_CT.has(ct)) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length <= MAX_BYTES) {
              const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
              const key = `ai/${newId("img")}.${ext}`;
              return await uploadToR2(key, buf, ct);
            }
          }
        }
      } catch {
        /* fall through to storing the original URL */
      }
    }
    return url; // allowlisted provider URL — safe to keep when R2 is unavailable
  }

  return undefined;
}

/**
 * R2/H8 — publish a Studio generation into the marketplace.
 * Before this endpoint existed, the Publish button was a plain <Link href="/explore">:
 * the whole generate → publish → sell loop dead-ended at step one.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to publish a design" } }, { status: 401 });
  }

  // M-1: throttle publishing (writes R2 + D1 and triggers revalidation).
  const rl = rateLimit(`${user.id}:designs-publish`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many publishes — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const source: "ai" | "upload" = body.source === "upload" ? "upload" : "ai";

  const seed = typeof body.seed === "string" ? body.seed.slice(0, 200) : "";
  let palette: [string, string, string] | undefined;
  let shape: number | undefined;
  let imageUrl: string | undefined;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 500) : "";
  let aiGenerated = true;
  let isPreview = false;

  if (source === "upload") {
    // Uploaded designs carry a real raster image — seed/palette/shape are optional.
    imageUrl = typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl.slice(0, 6000) : undefined;
    if (!imageUrl) {
      return NextResponse.json({ error: { code: "validation", message: "imageUrl is required for uploads" } }, { status: 400 });
    }
    // H-4b: only accept a same-origin /cdn/<key> path (what /api/upload returns).
    // Storing an arbitrary external URL would let the custom image loader turn
    // Image Resizing into a stored SSRF / open proxy.
    if (!isSameOriginCdnPath(imageUrl)) {
      return NextResponse.json(
        { error: { code: "validation", message: "imageUrl must be a /cdn/ path from this site" } },
        { status: 400 },
      );
    }
    aiGenerated = false;
    if (isPalette(body.palette)) palette = body.palette;
    const shapeRaw = Number(body.shape);
    if (Number.isInteger(shapeRaw) && shapeRaw >= 0 && shapeRaw <= 5) shape = shapeRaw;
  } else {
    // AI generation requires the generative triplet (seed/palette/shape).
    if (!seed) {
      return NextResponse.json({ error: { code: "validation", message: "seed is required" } }, { status: 400 });
    }
    if (!isPalette(body.palette)) {
      return NextResponse.json(
        { error: { code: "validation", message: "palette must be 3 hex colors" } },
        { status: 400 },
      );
    }
    const shapeRaw = Number(body.shape);
    if (!Number.isInteger(shapeRaw) || shapeRaw < 0 || shapeRaw > 5) {
      return NextResponse.json({ error: { code: "validation", message: "shape must be an integer 0-5" } }, { status: 400 });
    }
    palette = body.palette;
    shape = shapeRaw;
    // M-9: the client tells us whether this came from a real AI job or the
    // deterministic placeholder path (no provider configured). A placeholder is
    // NOT AI-generated — record it as a preview so listings/creator pages don't
    // misrepresent it.
    if (body.isPreview === true) {
      isPreview = true;
      aiGenerated = false;
    }
    // Persist the real Agnes raster (re-hosted to R2 for durability) so the
    // marketplace shows the actual generated art, not a procedural placeholder.
    imageUrl = await resolveAiImage(body.imageUrl);
  }

  const rawTitle = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  const title = rawTitle || (prompt ? prompt.slice(0, MAX_TITLE) : source === "upload" ? "Untitled upload" : "Untitled generation");

  const categoryRaw = typeof body.category === "string" ? body.category : "";
  const category = CATEGORIES.some((c) => c.id === categoryRaw) ? categoryRaw : "art";

  // ── M3: 商品选择（SKU 粒度） ──
  const rawProducts = Array.isArray(body.selectedProducts) ? body.selectedProducts : [];
  const selectedProducts: SelectedProduct[] = rawProducts
    .filter((p: unknown): p is { sku?: unknown; variant?: unknown } => typeof p === "object" && p !== null)
    .map((p) => ({
      sku: typeof p.sku === "string" ? p.sku : "",
      variant: typeof p.variant === "string" ? p.variant : undefined,
    }))
    .filter((p) => Boolean(p.sku) && Boolean(SKU_BY_ID[p.sku]));

  // 若发布表单勾选了具体 SKU，则 adapters 由这些 SKU 的 family 推导（兼容旧 UI/字段）；
  // 否则回退到旧的 adapters 字段，并据此重建 selectedProducts。
  let adapters: string[];
  if (selectedProducts.length > 0) {
    adapters = Array.from(
      new Set(selectedProducts.map((p) => adapterIdForSku(p.sku)).filter((a): a is string => Boolean(a))),
    );
  } else {
    const requested = Array.isArray(body.adapters) ? body.adapters : DEFAULT_ADAPTERS;
    adapters = requested
      .filter((a): a is string => typeof a === "string")
      .filter((a) => ADAPTERS.some((known) => known.id === a));
    if (adapters.length === 0) adapters.push(...DEFAULT_ADAPTERS);
    for (const a of adapters) {
      const sku = adapterDefaultSku(a);
      if (sku) selectedProducts.push({ sku });
    }
  }

  // ── M3: 分成比例（后端强制 0.10–0.50，缺省 0.30） ──
  const rateRaw = typeof body.royaltyRate === "number" ? body.royaltyRate : NaN;
  const royaltyRate = Number.isFinite(rateRaw) ? Math.min(0.5, Math.max(0.1, rateRaw)) : 0.3;

  const baseAdapter = ADAPTERS.find((a) => a.id === adapters[0]);
  if (!baseAdapter) {
    return NextResponse.json({ error: { code: "validation", message: "no valid adapter" } }, { status: 400 });
  }

  // Keep slugs unique across BOTH the static catalog and previously published designs,
  // otherwise a published design would shadow a catalog listing at the same URL.
  const store = designsStore();
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let n = 2;
  while (DESIGNS.some((d) => d.slug === slug) || store.has(slug)) {
    slug = `${baseSlug}-${n++}`;
    if (n > 200) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
      break;
    }
  }

  const premiumCents = 0; // creator-set premium is a later feature; publish at base retail.
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";

  // Honor curated tags from the publish body (e.g. batch manifests); fall back to
  // the prompt's first three words only when none are supplied.
  const rawTags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && Boolean(t.trim())).slice(0, 8).map((t) => t.trim())
    : [];
  const designTags =
    rawTags.length > 0
      ? rawTags
      : prompt
        ? prompt.split(/\s+/).filter(Boolean).slice(0, 3)
        : source === "upload"
          ? ["uploaded"]
          : ["generated"];

  // Early Creator Program：发布时把创作者的档位快照到设计上，下单时据此抬高分成比例。
  const creatorTier =
    (() => {
      const t = getUserById(user.id)?.creatorTier;
      return t === "early" || t === "founding" ? t : "standard";
    })();

  const design: PublishedDesign = {
    id: newId("dsn"),
    slug,
    user_id: user.id,
    title,
    category,
    tags: designTags,
    // D7-6: public creator identity is the handle, never the email local part
    // (email-derived ids leak PII and collide across domains).
    creator: user.handle || "you",
    creatorName: user.name || "You",
    creatorHandle: user.handle,
    creatorVerified: Boolean(getUserById(user.id)?.verified),
    seed: seed || slug,
    palette: palette || DEFAULT_PALETTE,
    shape: shape ?? 0,
    adapters,
    premiumCents,
    priceCents: baseAdapter.retailCents + premiumCents,
    aiGenerated,
    isPreview,
    prompt,
    description,
    source,
    royaltyRate,
    creatorTier,
    selectedProducts,
    created_at: new Date().toISOString(),
    imageUrl,
    status: "published",
  };

  store.set(slug, design);
  // Await the persist + version bump so the shared index is current before we
  // invalidate caches, then drop the explore shell so the edge serves the new
  // design on the next request. (Listing pages stay force-dynamic, so they need
  // no revalidation.)
  try {
    await persistDesign(design);
    revalidatePath("/explore");
  } catch {
    /* best-effort; the cross-instance version bump still refreshes the data layer */
  }

  return NextResponse.json(
    { slug: design.slug, id: design.id, title: design.title, price_cents: design.priceCents },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view your designs" } }, { status: 401 });
  }
  // R2: read from D1 (durable, cross-instance), not just this isolate's memory.
  // The old in-memory-only read made "My designs" empty whenever the request
  // landed on an instance that had not handled the publish.
  const mine = (await listDesignsForUserAsync(user.id)).map((d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    price_cents: d.priceCents,
    seed: d.seed,
    palette: d.palette,
    shape: d.shape,
    category: d.category,
    adapters: d.adapters,
    premium_cents: d.premiumCents,
    ai_generated: d.aiGenerated,
    is_preview: Boolean((d as PublishedDesign & { isPreview?: boolean }).isPreview),
    source: d.source,
    image_url: d.imageUrl,
    description: d.description,
    tags: d.tags,
    created_at: d.created_at,
  }));
  return NextResponse.json({ designs: mine }, { headers: { "Cache-Control": "no-store" } });
}
