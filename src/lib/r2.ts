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
 * P1 Images — FREE-PLAN optimization.
 *
 * Instead of letting Cloudflare Image Resizing / the Images product transform
 * every view on the fly (the ~12.5k on-zone + ~12k Images-product billable
 * events in the bill), we pre-generate a small fixed set of WIDTH variants ONCE
 * at upload and store each as `<key>/v<width>` in R2. At render time the loader
 * serves the nearest static variant via /cdn, so there is ZERO per-view
 * transformation cost. The only Images-product usage left is the one-time
 * variant generation at upload (negligible vs per-view).
 */
export const IMAGE_VARIANT_SIZES = [256, 640, 1080, 1920];

/** Map a next/image requested width to the smallest pre-generated variant that covers it. */
function nearestVariantSize(width: number): number {
  for (const s of IMAGE_VARIANT_SIZES) if (width <= s) return s;
  return IMAGE_VARIANT_SIZES[IMAGE_VARIANT_SIZES.length - 1];
}

/** Build the static-variant URL: "/cdn/<key>/v<width>". The <key> is the R2 key
 *  (no /cdn/ prefix — the /cdn route strips it), so we strip /cdn/ from src too. */
export function cdnVariantUrl(src: string, width: number): string {
  const key = src.startsWith("/cdn/")
    ? src.slice(5)
    : src.startsWith("/")
      ? src.slice(1)
      : src;
  return `/cdn/${key}/v${nearestVariantSize(width)}`;
}

async function generateImageVariants(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer | string,
): Promise<void> {
  const env = (getCloudflareContext() as any)?.env ?? {};
  if (!env?.IMAGES || !env?.BUCKET) return;
  if (typeof body === "string") return; // data-URL fallback path — nothing to transcode
  const bucket = env.BUCKET;
  for (const size of IMAGE_VARIANT_SIZES) {
    try {
      const chain = env.IMAGES.input(body as any);
      chain.transform({ width: size, fit: "cover" });
      const result = await chain.output({ format: "image/jpeg", quality: 80 });
      const resp = await result.response();
      const bytes = new Uint8Array(await resp.arrayBuffer());
      await bucket.put(`${key}/v${size}`, bytes, { contentType: "image/jpeg" });
    } catch (e) {
      console.error(`[r2] variant ${size} failed for ${key}:`, e instanceof Error ? e.message : e);
    }
  }
}

/**
 * Upload raw image bytes to R2 and return the same-origin /cdn path.
 * Also pre-generates static width variants (free-plan: no per-view transform).
 * Throws when R2 is not configured — callers should fall back to a data URL.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer | string,
  contentType: string,
): Promise<string> {
  const bucket = getBucket();
  await bucket.put(key, body as any, { contentType });
  // P1 Images: generate static variants once (free-plan — eliminates per-view
  // Cloudflare Image Resizing / Images-product charges). Best-effort: a variant
  // failure must never fail the upload.
  if (typeof body !== "string") {
    await generateImageVariants(key, body).catch((e) =>
      console.error("[r2] generateImageVariants failed:", e instanceof Error ? e.message : e),
    );
  }
  return cdnPathFor(key);
}

/**
 * P1 Images: delete the original AND its pre-generated variants. Used on design
 * deletion so variant objects don't accumulate orphans.
 */
export async function deleteImageWithVariants(key: string): Promise<boolean> {
  try {
    const bucket = getBucket();
    const enc = (k: string) => k.split("/").map(encodeURIComponent).join("/");
    await bucket.delete(enc(key));
    for (const size of IMAGE_VARIANT_SIZES) {
      await bucket.delete(enc(`${key}/v${size}`)).catch(() => {});
    }
    return true;
  } catch (e) {
    console.error("[r2] deleteImageWithVariants failed:", e instanceof Error ? e.message : e);
    return false;
  }
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
