import { getFromR2 } from "@/lib/r2";

// Serves original images stored in R2, same-origin, so the marketplace never
// depends on a public bucket URL. Cloudflare Image Resizing fetches /cdn/<key>
// from this origin to produce optimized variants (see ./image-loader.ts).
//
// B1 migration: @/lib/r2 now uses the native R2 binding (no aws4/S3 REST).
// NOT force-static: full-size originals are content-addressed and cached by the
// immutable cache-control header below; the route itself stays dynamic.
export const dynamic = "force-dynamic";

// H-5: only serve keys under a known, app-generated prefix. This is defense-in-depth
// on top of the unguessable key entropy — it prevents any future internal/private key
// (e.g. an exports or backups path) from ever being reachable through this public route.
const ALLOWED_PREFIXES = ["uploads/", "ai/", "public/", "cms/"];

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = (key || []).join("/");
  if (!objectKey || objectKey.includes("..") || objectKey.startsWith("/")) {
    return new Response("Not found", { status: 404 });
  }
  if (!ALLOWED_PREFIXES.some((p) => objectKey.startsWith(p))) {
    return new Response("Not found", { status: 404 });
  }
  const obj = await getFromR2(objectKey).catch(() => null);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.contentType,
      "x-content-type-options": "nosniff",
      // Keys are content-addressed on upload, so the bytes never change.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
