import { NextRequest, NextResponse } from "next/server";
import { listCmsPosts, createCmsPost, CMS_TYPES, type CmsType, type CmsPostInput } from "@/lib/cms";
import { getCmsKeyFromRequest, cmsKeyValid, unauthorized, cmsThrottled } from "@/lib/cmsAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const throttled = cmsThrottled(req);
  if (throttled) return throttled;
  if (!cmsKeyValid(getCmsKeyFromRequest(req))) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") as CmsType | null;
  const status = (sp.get("status") as "draft" | "published" | null) ?? "published";
  const limit = Math.min(Number(sp.get("limit") ?? 50) || 50, 200);
  const offset = Number(sp.get("offset") ?? 0) || 0;

  if (type && !CMS_TYPES.includes(type)) {
    return NextResponse.json({ error: "type must be one of: news, blog, faq" }, { status: 400 });
  }

  const posts = await listCmsPosts({ type: type ?? undefined, status, limit, offset });
  return NextResponse.json({ posts, count: posts.length });
}

export async function POST(req: NextRequest) {
  const throttled = cmsThrottled(req);
  if (throttled) return throttled;
  if (!cmsKeyValid(getCmsKeyFromRequest(req))) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const type = body.type as CmsType | undefined;
  const title = body.title as string | undefined;
  const body_md = body.body_md as string | undefined;

  if (!type || !CMS_TYPES.includes(type)) {
    return NextResponse.json({ error: "type is required and must be one of: news, blog, faq" }, { status: 400 });
  }
  if (!title || !body_md) {
    return NextResponse.json({ error: "title and body_md are required" }, { status: 400 });
  }

  const input: CmsPostInput = {
    type,
    title,
    body_md,
    slug: body.slug as string | undefined,
    excerpt: body.excerpt as string | undefined,
    cover_image: body.cover_image as string | undefined,
    author: body.author as string | undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    status: body.status as "draft" | "published" | undefined,
    published_at: typeof body.published_at === "number" ? body.published_at : undefined,
  };

  try {
    const post = await createCmsPost(input);
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create post" },
      { status: 500 },
    );
  }
}
