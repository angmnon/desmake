import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteDesignForUserAsync, getDesignBySlugForUser, updateDesignForUserAsync } from "@/lib/stores";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { deleteFromR2 } from "@/lib/r2";
import { rateLimit } from "@/lib/ratelimit";
import { recordError } from "@/lib/monitor";
import { ADAPTERS, adapterDefaultSku, type SelectedProduct } from "@/lib/data";

// No edge runtime — writes D1 + R2.

/**
 * R2-M-8: delete one of the caller's own published designs.
 *
 * Ownership is enforced inside deleteDesignForUserAsync (slug + user_id). A
 * design that exists but belongs to someone else returns the same 404 as a
 * non-existent slug, so this cannot be used to probe others' listing ids.
 * The design's R2 image is removed too, so deletions don't accumulate orphans.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to delete a design" } }, { status: 401 });
  }

  const rl = rateLimit(`${user.id}:designs-delete`, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: { code: "validation", message: "slug is required" } }, { status: 400 });
  }

  const removed = await deleteDesignForUserAsync(slug, user.id);
  if (!removed) {
    return NextResponse.json({ error: { code: "not_found", message: "Design not found" } }, { status: 404 });
  }

  // Best-effort R2 cleanup — the D1 row is already gone, so an R2 failure only
  // leaves an orphaned object (logged), it does not resurrect the listing.
  let imageDeleted = false;
  const key = r2KeyFromUrl(removed.imageUrl);
  if (key) {
    try {
      imageDeleted = await deleteFromR2(key);
    } catch (e) {
      recordError("designs/[slug].r2", e);
    }
  }

  revalidatePath("/explore");
  revalidatePath("/account");
  revalidatePath(`/design/${slug}`);

  return NextResponse.json({ ok: true, slug, image_deleted: imageDeleted }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * R2-M-9: in-place update of one of the caller's own designs (e.g. change the
 * selectable material families / adapters). Updates the D1 row directly — it does
 * NOT delete+recreate, so the slug stays stable across all instances.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to update a design" } }, { status: 401 });
  }

  const rl = rateLimit(`${user.id}:designs-update`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many updates — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: { code: "validation", message: "slug is required" } }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const existing = await getDesignBySlugForUser(slug, user.id);
  if (!existing) {
    return NextResponse.json({ error: { code: "not_found", message: "Design not found" } }, { status: 404 });
  }

  if (Array.isArray(body.adapters)) {
    const requested = body.adapters.filter((a): a is string => typeof a === "string");
    const adapters = requested.filter((a) => ADAPTERS.some((known) => known.id === a)).slice(0, 8);
    if (adapters.length > 0) {
      existing.adapters = adapters;
      existing.selectedProducts = adapters
        .map((a) => adapterDefaultSku(a))
        .filter((s): s is string => Boolean(s))
        .map((s) => ({ sku: s })) as SelectedProduct[];
    }
  }

  if (Array.isArray(body.tags)) {
    existing.tags = body.tags
      .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
      .slice(0, 8)
      .map((t) => t.trim());
  }

  try {
    await updateDesignForUserAsync(existing);
    revalidatePath("/explore");
    revalidatePath(`/design/${slug}`);
  } catch (e) {
    return NextResponse.json(
      { error: { code: "update_failed", message: e instanceof Error ? e.message : "update failed" } },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, slug, adapters: existing.adapters }, { status: 200 });
}

function r2KeyFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Images are served via /cdn/<key>; strip any /cdn-cgi/image transform prefix.
  const m = url.match(/\/cdn\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
