import { ImageResponse } from "next/og";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { findListingBySlug, publishedToDesign } from "@/lib/catalog";
import { findPublishedBySlug } from "@/lib/catalogIndex";
import { CREATORS, money, type Design } from "@/lib/data";

// NOTE: deliberately NOT setting `export const runtime = "edge"`.
// OpenNext runs the Node.js runtime on the Worker (see src/lib/db.ts); the Images
// binding + D1 lookup both require the Node runtime, and next/og works on it.

const INK = "#15171a";
const PAPER = "#f6f7f8";
const SILVER = "#9aa1ab";
const SILVER_LINE = "rgba(246,247,248,0.28)";

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

async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Fetch the product art already transcoded to a cover JPEG via Cloudflare Image
// Resizing, then embed as a data URL. Satori cannot decode WebP and makes its own
// sub-request for <img src>, so we pre-fetch + pin the format and avoid a second
// (WebP-capable) round trip at render time.
async function loadArtDataUrl(origin: string, design: Design): Promise<string | null> {
  if (!design.imageUrl || !design.imageUrl.startsWith("/")) return null;
  const normalized = design.imageUrl.replace(/^\//, "");
  const url = `${origin}/cdn-cgi/image/width=1200,height=630,fit=cover,quality=82,format=image%2Fjpeg/${normalized}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return `data:${ct};base64,${toBase64(buf)}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const origin = new URL(req.url).origin;
  const design = await resolveDesign(slug);
  const creatorName = design ? (CREATORS.find((c) => c.handle === design.creator)?.name ?? design.creator) : "";

  // Fonts — Inter TTF from static assets (Satori needs raw TTF/OTF, not woff2).
  // If any font fails to load, fall back to next/og's built-in default font.
  let fonts:
    | { name: string; data: ArrayBuffer; weight: number; style: string }[]
    | undefined;
  try {
    const [reg, semi, bold] = await Promise.all([
      loadFont(`${origin}/fonts/Inter-Regular.ttf`),
      loadFont(`${origin}/fonts/Inter-SemiBold.ttf`),
      loadFont(`${origin}/fonts/Inter-Bold.ttf`),
    ]);
    fonts = [
      { name: "Inter", data: reg, weight: 400, style: "normal" },
      { name: "Inter", data: semi, weight: 600, style: "normal" },
      { name: "Inter", data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    fonts = undefined;
  }

  const artUrl = design ? await loadArtDataUrl(origin, design) : null;
  const price = design ? money(design.priceCents) : "";
  const tag =
    design?.aiGenerated
      ? "AI-designed"
      : design?.category
        ? design.category
        : "";
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
            <div style={{ color: SILVER, fontSize: 26, fontWeight: 600 }}>
              by {creatorName}
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

  // Satori's FontOptions.weight is a string-literal union ("normal" | "semibold"
  // | "bold" | …) in this type version, but it accepts numeric weights at
  // runtime. Cast to satisfy the strict type without changing behavior.
  const imageResponse = new ImageResponse(card, {
    width: 1200,
    height: 630,
    fonts: (fonts as any) ?? [],
  });

  // Convert the PNG (ImageResponse is PNG-only) to JPEG@82 via the Cloudflare
  // Images binding so the card clears the ~300KB WhatsApp/Telegram cliff.
  const env = (getCloudflareContext() as { env?: Record<string, any> })?.env ?? {};
  let finalBody: BodyInit = await imageResponse.arrayBuffer();
  let contentType = "image/png";
  try {
    if (env.IMAGES) {
      const jpeg = await env.IMAGES
        .input(finalBody)
        .output({ format: "image/jpeg", quality: 82 })
        .response();
      finalBody = jpeg.body as BodyInit;
      contentType = "image/jpeg";
    }
  } catch (e) {
    console.error("[og] IMAGES PNG->JPEG conversion failed; serving PNG", e);
  }

  return new Response(finalBody, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
