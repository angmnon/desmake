import { ImageResponse } from "next/og";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { findListingBySlug, publishedToDesign } from "@/lib/catalog";
import { findPublishedBySlug } from "@/lib/catalogIndex";
import { CREATORS, money, type Design } from "@/lib/data";
import { getFromR2 } from "@/lib/r2";

// NOTE: deliberately NOT setting `export const runtime = "edge"`.
// OpenNext runs the Node.js runtime on the Worker (see src/lib/db.ts); the Images
// + R2 + Assets bindings and next/og all require the Node runtime.

const INK = "#15171a";
const PAPER = "#f6f7f8";
const SILVER = "#9aa1ab";
const SILVER_LINE = "rgba(246,247,248,0.28)";

const FONT_FILES: { file: string; weight: number }[] = [
  { file: "Inter-Regular.ttf", weight: 400 },
  { file: "Inter-SemiBold.ttf", weight: 600 },
  { file: "Inter-Bold.ttf", weight: 700 },
];

// Bump this whenever the card's visual composition changes, so cached renders
// (in R2 + at the edge) are invalidated and re-rendered with the new design.
const CARD_REVISION = "v2";

// Reuse the same O(1) published-design lookup the listing layout uses.
async function resolveDesign(slug: string): Promise<Design | undefined> {
  try {
    const fresh = await findPublishedBySlug(slug);
    if (fresh) return publishedToDesign(fresh);
  } catch {
    /* D1 disabled — fall through to the seed/in-memory result */
  }
  return findListingBySlug(slug);
}

// Deterministic, dependency-free hash (djb2) used as the R2 cache key. We only
// need a stable fingerprint of the design state + card revision, not cryptographic
// strength — collisions would just serve a slightly-wrong card, which is harmless.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// The cache key folds in every field that affects the rendered card, plus the
// CARD_REVISION (card-layout changes) and BUILD_REV (deploy/content version from
// wrangler.jsonc vars). Any change → a new key → a fresh render (old keys are
// orphaned but harmless; a future cleanup can prune them). BUILD_REV is bumped
// manually on content/metadata changes (per deploy convention) to force a global
// cache invalidation independent of the design-data hash.
function ogCacheKey(env: any, slug: string, design: Design | undefined): string {
  const buildRev = (env?.BUILD_REV as string) || "";
  if (!design) return `og/${slug}/${CARD_REVISION}__${buildRev}__missing.jpg`;
  const fingerprint = [
    CARD_REVISION,
    buildRev,
    design.title,
    design.priceCents,
    design.creator,
    design.imageUrl,
    design.rating,
    design.reviews,
    design.aiGenerated,
    design.category,
  ].join("|");
  return `og/${slug}/${hashString(fingerprint)}.jpg`;
}

// Best-effort R2 read/write of the rendered card. Uses the BUCKET binding
// directly (keys here are [a-z0-9._-] only, so no encoding needed). Never throws.
async function readCachedCard(
  env: any,
  key: string,
): Promise<ArrayBuffer | null> {
  try {
    const obj = await env?.BUCKET?.get(key);
    if (obj) return (await obj.arrayBuffer()) as ArrayBuffer;
  } catch {
    /* ignore */
  }
  return null;
}
async function writeCachedCard(
  env: any,
  key: string,
  body: ArrayBuffer,
): Promise<void> {
  try {
    await env?.BUCKET?.put(key, body, { contentType: "image/jpeg" });
  } catch {
    /* ignore — cache miss on next request is fine */
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Load a font from the static-asset binding. This AVOIDS an external self-fetch,
// which is blocked by the site's WAF (browser-UA required) and can loop back into
// the Worker. Falls back to a same-origin fetch only if the binding is missing.
async function loadFont(
  env: any,
  file: string,
  weight: number,
): Promise<{ data: ArrayBuffer; weight: number } | null> {
  try {
    if (env?.ASSETS) {
      const res = await env.ASSETS.fetch(new URL(`/fonts/${file}`, "http://localhost"));
      if (res.ok) return { data: await res.arrayBuffer(), weight };
    }
  } catch {
    /* fall through to origin fetch */
  }
  try {
    const res = await fetch(`https://desmake.com/fonts/${file}`);
    if (res.ok) return { data: await res.arrayBuffer(), weight };
  } catch {
    /* ignore */
  }
  return null;
}

// Transcode bytes to JPEG via the Cloudflare Images binding.
// API (this wrangler/runtime version): IMAGES.input(buf).transform(...).output(opts)
// returns a Promise<TransformationResultImpl>; awaiting it gives a result whose
// .response() returns a Response. (Calling .response() on the Promise itself is a
// no-op/error — that was the original bug.)
async function transcodeToJpeg(
  env: any,
  input: ArrayBuffer,
  transform?: { width: number; height: number; fit: string },
): Promise<ArrayBuffer | null> {
  if (!env?.IMAGES) return null;
  try {
    let chain: any = env.IMAGES.input(input);
    if (transform) chain = chain.transform(transform);
    const result = await chain.output({ format: "image/jpeg", quality: 82 });
    const resp = await result.response();
    return (await resp.arrayBuffer()) as ArrayBuffer;
  } catch {
    return null;
  }
}

// Read the product art from R2 (binding) and transcode it to a cover JPEG via the
// Images binding. This neutralizes WebP (Satori can't decode it) and keeps the
// embedded payload small — and, critically, makes zero external HTTP requests.
//
// design.imageUrl is either "/cdn/<key>" or, most often, a Cloudflare Image
// Resizing URL like "/cdn-cgi/image/width=3840/cdn/<key>". The actual R2 key is
// the segment after the real "/cdn/" (note: "/cdn-cgi/" does NOT match).
async function loadArtDataUrl(env: any, design: Design): Promise<string | null> {
  const url = design.imageUrl;
  if (!url) return null;
  const m = url.match(/\/cdn\/(.+)$/);
  const key = m ? m[1] : null;
  if (!key) return null;
  try {
    const obj = await getFromR2(key);
    if (!obj) return null;
    const jpeg = await transcodeToJpeg(env, obj.body, {
      width: 1200,
      height: 630,
      fit: "cover",
    });
    if (jpeg) return `data:image/jpeg;base64,${toBase64(jpeg)}`;
    return `data:${obj.contentType};base64,${toBase64(obj.body)}`;
  } catch {
    return null;
  }
}

// Serve the generic static OG card (PNG) on any render failure, so social
// previews never hard-error. Best-effort.
async function serveFallback(): Promise<Response> {
  try {
    const env = (getCloudflareContext() as any)?.env ?? {};
    if (env?.ASSETS) {
      const res = await env.ASSETS.fetch(new URL("/og.png", "http://localhost"));
      if (res.ok) {
        return new Response(await res.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }
  } catch {
    /* ignore */
  }
  return new Response("OG render failed", { status: 500 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const env = (getCloudflareContext() as any)?.env ?? {};
    const design = await resolveDesign(slug);

    // Phase 2: fast path — serve a previously rendered card from R2, skipping the
    // expensive Satori + Images transcode entirely. Edge cache still applies on top.
    const cacheKey = ogCacheKey(env, slug, design);
    const cached = await readCachedCard(env, cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    const creatorName = design
      ? CREATORS.find((c) => c.handle === design.creator)?.name ?? design.creator
      : "";

    // Fonts — Inter TTF from the static-asset binding (Satori needs raw TTF/OTF,
    // not woff2). If all fail, fall back to next/og's built-in default font.
    const loaded = (
      await Promise.all(FONT_FILES.map((f) => loadFont(env, f.file, f.weight)))
    ).filter(Boolean) as { data: ArrayBuffer; weight: number }[];
    const fonts = loaded.length
      ? loaded.map((f) => ({ name: "Inter", data: f.data, weight: f.weight, style: "normal" }))
      : undefined;

    const artUrl = design ? await loadArtDataUrl(env, design) : null;
    const price = design ? money(design.priceCents) : "";
    const tag = design?.aiGenerated ? "AI-designed" : design?.category ? design.category : "";
    const rating =
      design && design.rating > 0 && design.reviews > 0
        ? `★ ${design.rating.toFixed(1)} · ${design.reviews.toLocaleString()} reviews`
        : "";

    const card = (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          backgroundColor: INK,
          fontFamily: "Inter",
          overflow: "hidden",
        }}
      >
        {artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artUrl}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "1200px",
              height: "630px",
              objectFit: "cover",
            }}
          />
        ) : null}
        {/* dark gradient for legibility (transparent -> ink) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(21,23,26,0.94) 0%, rgba(21,23,26,0.55) 38%, rgba(21,23,26,0) 66%)",
          }}
        />
        {/* top-left wordmark */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: PAPER,
              color: INK,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            D
          </div>
          <div style={{ color: PAPER, fontSize: 28, fontWeight: 700, letterSpacing: "0.02em" }}>
            Desmake
          </div>
        </div>
        {/* bottom info block */}
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 48,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              color: PAPER,
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.04,
              maxWidth: 880,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {design ? design.title : "Custom print-on-demand art"}
          </div>

          {/* Phase 3 micro-copy: reinforces the make-it-yours hook */}
          <div
            style={{
              color: SILVER,
              fontSize: 24,
              fontWeight: 500,
              display: "flex",
            }}
          >
            Make it yours on Desmake
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {creatorName ? (
              <div style={{ color: SILVER, fontSize: 26, fontWeight: 600, display: "flex" }}>
                {`by ${creatorName}`}
              </div>
            ) : null}
            {tag ? (
              <div
                style={{
                  color: PAPER,
                  fontSize: 20,
                  fontWeight: 600,
                  padding: "6px 14px",
                  border: `1px solid ${SILVER_LINE}`,
                  borderRadius: 4,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {tag}
              </div>
            ) : null}
            {rating ? (
              <div style={{ color: SILVER, fontSize: 22, fontWeight: 500 }}>{rating}</div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 4 }}>
            {price ? (
              <div
                style={{
                  background: "rgba(246,247,248,0.14)",
                  border: `1px solid ${SILVER_LINE}`,
                  color: PAPER,
                  padding: "12px 22px",
                  borderRadius: 4,
                  fontSize: 32,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: SILVER, fontSize: 20, fontWeight: 600 }}>From</span>
                {price}
              </div>
            ) : null}
            <div
              style={{
                background: PAPER,
                color: INK,
                padding: "14px 28px",
                borderRadius: 4,
                fontSize: 26,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              Customize &amp; Buy →
            </div>
          </div>
        </div>
      </div>
    );

    // Satori's FontOptions.weight is a string-literal union in this type version,
    // but numeric weights are accepted at runtime. Cast to keep behavior intact.
    const imageResponse = new ImageResponse(card, {
      width: 1200,
      height: 630,
      fonts: (fonts as any) ?? [],
    });

    // Convert the PNG (ImageResponse is PNG-only) to JPEG@82 via the Cloudflare
    // Images binding so the card clears the ~300KB WhatsApp/Telegram cliff.
    let finalBody: ArrayBuffer | ReadableStream = await imageResponse.arrayBuffer();
    let contentType = "image/png";
    const jpeg = await transcodeToJpeg(env, finalBody as ArrayBuffer);
    if (jpeg) {
      finalBody = jpeg;
      contentType = "image/jpeg";
    }

    // Phase 2: persist the rendered card to R2 so the fast path serves it next time.
    if (jpeg) await writeCachedCard(env, cacheKey, jpeg);

    return new Response(finalBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    // Resilience: on any render failure, serve the generic static OG card rather
    // than a hard 500 (so share previews never break).
    console.error("[og] render failed; serving fallback", err);
    return serveFallback();
  }
}
