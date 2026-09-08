// R2 image storage for uploaded designs (Cloudflare Workers, B1 migration).
//
// B1 migration: R2 is now a NATIVE binding (`BUCKET` in wrangler.jsonc), accessed
// via getCloudflareContext().env.BUCKET — NOT the S3-compatible REST API. This
// removes the aws4 signing and the need for S3 credentials. The edge /cdn route
// still serves originals (now via this binding); Cloudflare Image Resizing
// (/cdn-cgi/image/...) transforms them at the edge for next/image.

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Native binding is mandatory now. Exported constant so existing
// `if (!R2_ENABLED)` guards keep compiling unchanged.
export const R2_ENABLED = true;

function getBucket(): any {
  const env = (getCloudflareContext() as any)?.env ?? {};
  const bucket = env.BUCKET;
  if (!bucket) throw new Error("R2 binding (BUCKET) is not configured");
  return bucket;
}

/** Public-ish same-origin path the listing/card will use to load the image. */
export function cdnPathFor(key: string): string {
  return `/cdn/${key}`;
}

/**
 * Upload raw image bytes to R2 and return the same-origin /cdn path.
 * Throws when R2 is not configured — callers should fall back to a data URL.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer | string,
  contentType: string,
): Promise<string> {
  const bucket = getBucket();
  await bucket.put(key, body as any, { contentType });
  return cdnPathFor(key);
}

/**
 * Read an object back out of R2 through the native binding.
 *
 * Browsers never need this — the /cdn route serves the original directly from the
 * binding at the origin, and Cloudflare Image Resizing fetches /cdn/<key> from the
 * origin to produce optimized variants.
 */
export async function getFromR2(
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const bucket = getBucket();
  const obj = await bucket.get(key.split("/").map(encodeURIComponent).join("/"));
  if (!obj) return null;
  const buf = await obj.arrayBuffer();
  return { body: buf, contentType: obj.contentType || "image/jpeg" };
}

/**
 * M-8: delete an object from R2. Previously the codebase had no deletion path at all,
 * so replaced/re-uploaded design images became permanent orphans and storage cost grew
 * unbounded. Call this when a design is deleted or its image is replaced. Re-encodes
 * the key the same way getFromR2 reads it.
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const bucket = getBucket();
    await bucket.delete(key.split("/").map(encodeURIComponent).join("/"));
    return true;
  } catch (e) {
    console.error("[r2] deleteFromR2 failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
