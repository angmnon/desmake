import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { designsStore, newId, type PublishedDesign } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { ADAPTERS, DESIGNS, CATEGORIES } from "@/lib/data";

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

/**
 * R2/H8 — publish a Studio generation into the marketplace.
 * Before this endpoint existed, the Publish button was a plain <Link href="/explore">:
 * the whole generate → publish → sell loop dead-ended at step one.
 */
export async function POST(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to publish a design" } }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const seed = typeof body.seed === "string" ? body.seed.slice(0, 200) : "";
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

  const rawTitle = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 500) : "";
  const title = rawTitle || (prompt ? prompt.slice(0, MAX_TITLE) : "Untitled generation");

  const categoryRaw = typeof body.category === "string" ? body.category : "";
  const category = CATEGORIES.some((c) => c.id === categoryRaw) ? categoryRaw : "art";

  const requested = Array.isArray(body.adapters) ? body.adapters : DEFAULT_ADAPTERS;
  const adapters = requested
    .filter((a): a is string => typeof a === "string")
    .filter((a) => ADAPTERS.some((known) => known.id === a));
  if (adapters.length === 0) adapters.push(...DEFAULT_ADAPTERS);

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
  const design: PublishedDesign = {
    id: newId("dsn"),
    slug,
    user_id: user.id,
    title,
    category,
    tags: prompt ? prompt.split(/\s+/).filter(Boolean).slice(0, 3) : ["generated"],
    creator: user.email.split("@")[0].slice(0, 40) || "you",
    creatorName: user.name || "You",
    seed,
    palette: body.palette,
    shape: shapeRaw,
    adapters,
    premiumCents,
    priceCents: baseAdapter.retailCents + premiumCents,
    aiGenerated: true,
    prompt,
    created_at: new Date().toISOString(),
  };

  store.set(slug, design);

  return NextResponse.json(
    { slug: design.slug, id: design.id, title: design.title, price_cents: design.priceCents },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view your designs" } }, { status: 401 });
  }
  const mine = Array.from(designsStore().values())
    .filter((d) => d.user_id === user.id)
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      price_cents: d.priceCents,
      seed: d.seed,
      palette: d.palette,
      shape: d.shape,
      created_at: d.created_at,
    }));
  return NextResponse.json({ designs: mine }, { headers: { "Cache-Control": "no-store" } });
}
