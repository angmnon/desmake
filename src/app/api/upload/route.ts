import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { uploadToR2, R2_ENABLED } from "@/lib/r2";
import { newId } from "@/lib/stores";

// Node runtime — uses Buffer + the S3 client (aws4) for R2 uploads.
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Accept a browser-compressed image (data URL), store it, and return a URL the
 * listing/card can render. When R2 is configured the image lands in the bucket and
 * we return a same-origin `/cdn/<key>` path; otherwise we echo the data URL back
 * so the upload → publish flow still works end-to-end (data URL stored in D1).
 */
export async function POST(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to upload" } }, { status: 401 });
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

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `uploads/${user.id}/${newId("img")}.${ext}`;

  if (R2_ENABLED) {
    try {
      const url = await uploadToR2(key, buf, contentType);
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
