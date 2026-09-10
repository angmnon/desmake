import { NextRequest, NextResponse } from "next/server";
import {
  getCmsPostById,
  updateCmsPost,
  deleteCmsPost,
  type CmsPostInput,
} from "@/lib/cms";
import { getCmsKeyFromRequest, cmsKeyValid, unauthorized, cmsThrottled } from "@/lib/cmsAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const throttled = cmsThrottled(req);
  if (throttled) return throttled;
  if (!cmsKeyValid(getCmsKeyFromRequest(req))) return unauthorized();
  const { id } = await params;
  const post = await getCmsPostById(id);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const throttled = cmsThrottled(req);
  if (throttled) return throttled;
  if (!cmsKeyValid(getCmsKeyFromRequest(req))) return unauthorized();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const patch: Partial<CmsPostInput> = {};
  for (const k of [
    "type",
    "title",
    "body_md",
    "slug",
    "excerpt",
    "cover_image",
    "author",
    "tags",
    "status",
    "published_at",
  ] as const) {
    if (body[k] !== undefined) (patch as Record<string, unknown>)[k] = body[k];
  }

  const post = await updateCmsPost(id, patch);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const throttled = cmsThrottled(req);
  if (throttled) return throttled;
  if (!cmsKeyValid(getCmsKeyFromRequest(req))) return unauthorized();
  const { id } = await params;
  const ok = await deleteCmsPost(id);
  return NextResponse.json({ ok });
}
