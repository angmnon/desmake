import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { uploadToR2, R2_ENABLED } from "@/lib/r2";
import { newId } from "@/lib/stores";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Node runtime — uses Buffer + the S3 client (aws4) for R2 uploads.
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * R2-Low: identify an image by its magic bytes rather than trusting the
 * client-declared data-URL MIME type. A data URL is a label the caller controls,
 * so `<svg onload=...>` (or an HTML/JS polyglot) could be uploaded as
 * "image/png" and later served from our CDN. Sniffing the real format and
 * requiring it to match the declared type closes that gap.
 */
function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // "RIFF"
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Accept a browser-compressed image (data URL), store it, and return a URL the
 * listing/card can render. When R2 is configured the image lands in the bucket and
 * we return a same-origin `/cdn/<key>` path; otherwise we echo the data URL back
 * so the upload → publish flow still works end-to-end (data URL stored in D1).
 */
export async function POST(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to upload" } }, { status: 401 });
  }

  // M-1: throttle uploads — they write bytes to R2 and cost money per call.
  const rl = rateLimit(`${user.id}:upload`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many uploads — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { image?: string };
  try {
    body = (await request.json()) as { image?: string };
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const dataUrl = body.image;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: { code: "validation", message: "image data URL required" } }, { status: 400 });
  }

  const meta = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!meta) {
    return NextResponse.json({ error: { code: "validation", message: "unsupported image format" } }, { status: 400 });
  }
  const contentType = meta[1];
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: { code: "validation", message: "allowed types: JPEG, PNG, WebP" } }, { status: 400 });
  }

  const buf = Buffer.from(meta[2], "base64");
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: { code: "too_large", message: "image too large (max 4MB)" } }, { status: 413 });
  }

  // R2-Low: verify the payload really is the image type it claims to be.
  const sniffed = sniffImageType(buf);
  if (!sniffed) {
    return NextResponse.json({ error: { code: "validation", message: "file is not a valid JPEG, PNG or WebP image" } }, { status: 400 });
  }
  if (sniffed !== contentType) {
    return NextResponse.json({ error: { code: "validation", message: "image content does not match its declared type" } }, { status: 400 });
  }

  const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
  const key = `uploads/${user.id}/${newId("img")}.${ext}`;

  if (R2_ENABLED) {
    try {
      const url = await uploadToR2(key, buf, sniffed);
      return NextResponse.json({ url }, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: { code: "upload_failed", message: e instanceof Error ? e.message : "upload failed" } },
        { status: 502 },
      );
    }
  }

  // R2 not configured — store the (already compressed) data URL directly.
  return NextResponse.json({ url: dataUrl, fallback: true }, { status: 201 });
}
