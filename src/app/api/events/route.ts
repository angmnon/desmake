import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { recordDesignEvent, hashIp, type DesignEventKind } from "@/lib/analytics";

const ALLOWED: DesignEventKind[] = ["view", "save", "share"];

// No edge runtime — recordDesignEvent writes the events store / D1 (R2/C1).

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const slug = typeof body.design_slug === "string" ? body.design_slug.slice(0, 200) : "";
  const rawEvent = typeof body.event === "string" ? body.event : "";
  if (!slug || !ALLOWED.includes(rawEvent as DesignEventKind)) {
    return NextResponse.json({ error: { code: "validation", message: "design_slug and a valid event are required" } }, { status: 400 });
  }
  const event = rawEvent as DesignEventKind;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const referrerHandle = request.cookies.get("dm_ref")?.value || null;

  // Fire-and-forget; never block the response on D1 latency.
  void recordDesignEvent(slug, event, { ipHash: hashIp(ip), referrerHandle });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
