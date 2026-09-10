import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { recordDesignEvent, hashIp, type DesignEventKind } from "@/lib/analytics";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const ALLOWED: DesignEventKind[] = ["view", "save", "share"];

// No edge runtime — recordDesignEvent writes the events store / D1 (R2/C1).

export async function POST(request: NextRequest) {
  // R2-M-4: this endpoint is anonymous and writes to D1, so it must be throttled.
  // Without a limit, a single client could inflate the events table (cost abuse /
  // index pollution). 20 writes/min per IP is well above any real browsing rate.
  const rl = rateLimit(`${clientIp(request)}:events`, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter), "Cache-Control": "no-store" } },
    );
  }

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

  const ip = clientIp(request);
  const referrerHandle = request.cookies.get("dm_ref")?.value || null;

  // Fire-and-forget; never block the response on D1 latency.
  void recordDesignEvent(slug, event, { ipHash: hashIp(ip), referrerHandle });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
