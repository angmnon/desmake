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
    if (env?.IMAGES) {
      // .output() resolves to a Response (NOT .response()/.image() — those are
      // not functions in this binding version). Resize to cover 1200x630 and
      // re-encode as JPEG so the embedded payload stays small.
      const resp = await env.IMAGES
        .input(obj.body)
        .transform({ width: 1200, height: 630, fit: "cover" })
        .output({ format: "image/jpeg", quality: 82 });
      const buf = await resp.arrayBuffer();
      return `data:image/jpeg;base64,${toBase64(buf)}`;
    }
    return `data:${obj.contentType};base64,${toBase64(obj.body)}`;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const env = (getCloudflareContext() as any)?.env ?? {};
    const design = await resolveDesign(slug);
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
    if (new URL(_req.url).searchParams.get("debug") === "1") {
      const d: Record<string, unknown> = { artUrlLen: artUrl ? artUrl.length : 0 };
      try {
        if (design?.imageUrl) {
          const mm = design.imageUrl.match(/\/cdn\/(.+)$/);
          const k = mm ? mm[1] : null;
          d.key = k;
          if (k && env?.IMAGES) {
            const o = await getFromR2(k);
            d.r2 = o ? `${o.contentType} ${o.body.byteLength}` : "null";
            if (o) {
              try {
                const out = await (env.IMAGES as any)
                  .input(o.body)
                  .transform({ width: 1200, height: 630, fit: "cover" })
                  .output({ format: "image/jpeg", quality: 82 });
                d.outCtor = out?.constructor?.name;
                d.outOwn = out ? Object.getOwnPropertyNames(out).join(",") : "null";
                d.outProto = out ? Object.getOwnPropertyNames(Object.getPrototypeOf(out)).join(",") : "null";
                for (const m of ["response", "image", "blob", "arrayBuffer", "bytes", "readable", "body", "text"]) {
                  d["m_" + m] = out ? typeof out[m] : "no-out";
                }
                for (const m of ["response", "image", "blob"]) {
                  try {
                    const r = await out[m]();
                    if (r && typeof r.arrayBuffer === "function") {
                      const ab = await r.arrayBuffer();
                      d["call_" + m + "_bytes"] = ab.byteLength;
                    } else {
                      d["call_" + m] = typeof r + (r?.constructor?.name ? ":" + r.constructor.name : "");
                    }
                  } catch (e) {
                    d["call_" + m + "_err"] = e instanceof Error ? e.message : String(e);
                  }
                }
              } catch (e) {
                d.outErr = e instanceof Error ? e.message : String(e);
              }
            }
          }
        }
      } catch (e) {
        d.err = e instanceof Error ? e.message : String(e);
      }
      return new Response(JSON.stringify(d, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
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
    try {
      if (env.IMAGES) {
        const resp = await env.IMAGES
          .input(finalBody as ArrayBuffer)
          .output({ format: "image/jpeg", quality: 82 });
        finalBody = (await resp.arrayBuffer()) as ArrayBuffer;
        contentType = "image/jpeg";
      }
    } catch (e) {
      console.error("[og] IMAGES PNG->JPEG conversion failed; serving PNG", e);
    }

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
}
