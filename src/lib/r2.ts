// R2 image storage for uploaded designs.
//
// The container is a plain Node process, so it reaches R2 through the S3-compatible
// API (aws4-signed PUT) rather than an R2 binding. Credentials are injected as env
// vars by wrangler secrets; the binding in worker.mjs is only used to *serve* the
// images back via the same-origin /cdn route.
//
// Node runtime only — do NOT add `export const runtime = "edge"` to any route that
// imports this module.

import aws4 from "aws4";

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
export const R2_BUCKET = process.env.R2_BUCKET || "desmake-assets";
const R2_ACCESS_KEY_ID = process.env.R2_S3_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_S3_SECRET_ACCESS_KEY || "";

export const R2_ENABLED = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

/** Public-ish same-origin path the listing/card will use to load the image. */
export function cdnPathFor(key: string): string {
  return `/cdn/${key}`;
}

/**
 * Upload raw image bytes to R2 and return the same-origin /cdn path.
 * Throws when R2 is not configured — callers should fall back to a data URL.
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!R2_ENABLED) throw new Error("R2 not configured");
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = `/${R2_BUCKET}/${key}`;
  const signed = aws4.sign(
    {
      host,
      path,
      method: "PUT",
      region: "auto",
      service: "s3",
      body,
      headers: { "Content-Type": contentType, "Content-Length": String(body.length) },
    },
    { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  );
  const res = await fetch(`https://${host}${path}`, {
    method: "PUT",
    headers: signed.headers as Record<string, string>,
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`R2 upload failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  return cdnPathFor(key);
}
