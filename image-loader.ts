import type { ImageLoaderProps } from "next/image";

// B1 migration: replace the in-container sharp/next-image optimizer with Cloudflare
// Image Resizing (transform-on-the-fly). Images live in R2 (served same-origin via
// /cdn); Cloudflare resizes them at the edge via /cdn-cgi/image/<options>/<src>.
// This removes the dependency on a 1 GiB container instance for image transcoding.
// Enable "Transformations" on the desmake.com zone and allow the R2 bucket as a source.
const normalizeSrc = (src: string) => (src.startsWith("/") ? src.slice(1) : src);

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  const params = [`width=${width}`];
  if (quality) params.push(`quality=${quality}`);
  if (process.env.NODE_ENV === "development") {
    // Serve the original during `next dev` (no edge image pipeline locally).
    return `${src}?${params.join("&")}`;
  }
  // H-12: if Cloudflare Image Resizing is not enabled on the zone, the /cdn-cgi/image/
  // path returns 404 for every image and the site goes blank. Degrade gracefully to the
  // original same-origin /cdn/<key> asset (still served via the cdn route above).
  if (process.env.IMAGE_RESIZING_ENABLED !== "true") {
    return `${src}?${params.join("&")}`;
  }
  return `/cdn-cgi/image/${params.join(",")}/${normalizeSrc(src)}`;
}
