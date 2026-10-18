import type { ImageLoaderProps } from "next/image";
import { cdnVariantUrl } from "@/lib/r2";

// P1 Images — FREE-PLAN: serve a pre-generated static variant from R2. No on-the-fly
// Cloudflare Image Resizing / Images-product transform => zero per-view cost. If the
// variant hasn't been backfilled yet (legacy image), the /cdn route transparently
// falls back to the original, so images never break.
export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  if (process.env.NODE_ENV === "development") {
    // Serve the original during `next dev` (no edge image pipeline locally).
    return `${src}?width=${width}${quality ? `&quality=${quality}` : ""}`;
  }
  // H-12: if resizing/optimization is disabled, or the image isn't an R2 /cdn asset,
  // serve the original as-is — no transform, no cost.
  if (process.env.IMAGE_RESIZING_ENABLED !== "true") {
    return src;
  }
  if (!src.startsWith("/cdn/")) {
    return src;
  }
  return cdnVariantUrl(src, width);
}
