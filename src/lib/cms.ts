// CMS content layer (D1-backed). Powers the operations API at /api/cms and the
// public /news, /faq and /blog rendering. Content is stored in D1 (not the
// filesystem) so the ops team can publish updates via the API at runtime without
// a rebuild.
//
// Node runtime only — do NOT add `export const runtime = "edge"` to any route that
// imports this module (it depends on d1Query, which talks to the D1 REST API).

import { d1Query, D1_ENABLED } from "@/lib/db";
import { newId } from "@/lib/stores";

export type CmsType = "news" | "blog" | "faq";
export const CMS_TYPES: CmsType[] = ["news", "blog", "faq"];

export type CmsPost = {
  id: string;
  type: CmsType;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_image: string | null;
  author: string;
  tags: string[];
  status: "draft" | "published";
  published_at: number; // epoch ms
  created_at: number;
  updated_at: number;
};

export type CmsPostInput = {
  type: CmsType;
  title: string;
  body_md: string;
  slug?: string;
  excerpt?: string;
  cover_image?: string;
  author?: string;
  tags?: string[];
  status?: "draft" | "published";
  published_at?: number;
};

export function slugify(s: string): string {
  const out = s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return out || "post";
}

function rowToPost(r: Record<string, unknown>): CmsPost {
  let tags: string[] = [];
  try {
    if (r.tags) tags = JSON.parse(String(r.tags));
  } catch {
    tags = [];
  }
  return {
    id: String(r.id),
    type: r.type as CmsType,
    slug: String(r.slug),
    title: String(r.title),
    excerpt: (r.excerpt as string) ?? "",
    body_md: String(r.body_md),
    cover_image: (r.cover_image as string) ?? null,
    author: (r.author as string) ?? "Desmake",
    tags,
    status: (r.status as "draft" | "published") ?? "published",
    published_at: Number(r.published_at),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  };
}

export async function listCmsPosts(opts: {
  type?: CmsType;
  status?: "draft" | "published";
  limit?: number;
  offset?: number;
} = {}): Promise<CmsPost[]> {
  if (!D1_ENABLED) return [];
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.type) {
    where.push("type = ?");
    params.push(opts.type);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const rows = await d1Query(
    `SELECT * FROM cms_posts ${w} ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToPost);
}

export async function getCmsPostBySlug(type: CmsType, slug: string): Promise<CmsPost | undefined> {
  if (!D1_ENABLED) return undefined;
  const rows = await d1Query(
    `SELECT * FROM cms_posts WHERE type = ? AND slug = ? AND status = 'published' LIMIT 1`,
    [type, slug],
  );
  return rows[0] ? rowToPost(rows[0]) : undefined;
}

export async function getCmsPostById(id: string): Promise<CmsPost | undefined> {
  if (!D1_ENABLED) return undefined;
  const rows = await d1Query(`SELECT * FROM cms_posts WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? rowToPost(rows[0]) : undefined;
}

export async function createCmsPost(input: CmsPostInput): Promise<CmsPost> {
  const id = newId("cms");
  const slug = input.slug?.trim() || slugify(input.title);
  const now = Date.now();
  const published_at = input.published_at ?? now;
  const status = input.status ?? "published";
  const tags = JSON.stringify(input.tags ?? []);
  await d1Query(
    `INSERT INTO cms_posts
       (id, type, slug, title, excerpt, body_md, cover_image, author, tags, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      slug,
      input.title,
      input.excerpt ?? "",
      input.body_md,
      input.cover_image ?? null,
      input.author ?? "Desmake",
      tags,
      status,
      published_at,
      now,
      now,
    ],
  );
  const created = await getCmsPostById(id);
  if (!created) throw new Error("Failed to read back the created post");
  return created;
}

export async function updateCmsPost(
  id: string,
  patch: Partial<CmsPostInput>,
): Promise<CmsPost | undefined> {
  const existing = await getCmsPostById(id);
  if (!existing) return undefined;
  const slug = patch.slug?.trim() || existing.slug;
  const title = patch.title ?? existing.title;
  const excerpt = patch.excerpt ?? existing.excerpt;
  const body_md = patch.body_md ?? existing.body_md;
  const cover_image = patch.cover_image !== undefined ? patch.cover_image : existing.cover_image;
  const author = patch.author ?? existing.author;
  const tags = patch.tags ? JSON.stringify(patch.tags) : JSON.stringify(existing.tags);
  const status = patch.status ?? existing.status;
  const published_at = patch.published_at ?? existing.published_at;
  const updated_at = Date.now();
  await d1Query(
    `UPDATE cms_posts
     SET slug=?, title=?, excerpt=?, body_md=?, cover_image=?, author=?, tags=?, status=?, published_at=?, updated_at=?
     WHERE id=?`,
    [slug, title, excerpt, body_md, cover_image, author, tags, status, published_at, updated_at, id],
  );
  return getCmsPostById(id);
}

export async function deleteCmsPost(id: string): Promise<boolean> {
  if (!D1_ENABLED) return false;
  await d1Query(`DELETE FROM cms_posts WHERE id = ?`, [id]);
  return true;
}
