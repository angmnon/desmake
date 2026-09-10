import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionAsync, SESSION_COOKIE, updateCreatorProfile } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";

// No edge runtime — updateCreatorProfile writes the user store / D1 (R2/C1).

export async function PATCH(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to edit your profile" } }, { status: 401 });
  }

  // M-1: throttle profile writes (PII mutation).
  const rl = rateLimit(`${user.id}:profile`, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests — slow down" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const patch: { bio?: string; city?: string; roleTag?: string; name?: string } = {};
  if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 280);
  if (typeof body.city === "string") patch.city = body.city.slice(0, 80);
  if (typeof body.roleTag === "string") patch.roleTag = body.roleTag.slice(0, 60);
  if (typeof body.name === "string") patch.name = body.name.slice(0, 80);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: { code: "validation", message: "No valid fields to update" } }, { status: 400 });
  }

  await updateCreatorProfile(user.id, patch);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
