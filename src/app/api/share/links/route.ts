import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { getSiteBaseUrl } from "@/lib/url";

// No edge runtime — reads the session store (R2/C1).

/**
 * Returns the share links for the current creator:
 *  - `ref_link`: the attribution link that plants the dm_ref cookie and earns a
 *    7% referral commission on any purchase the visitor makes.
 *  - `profile_link`: the public creator profile URL.
 */
export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view share links" } }, { status: 401 });
  }
  // NOT `new URL(request.url).origin` — inside the Cloudflare Container that is the
  // internal host (http://0.0.0.0:3000), which would hand the creator a dead link.
  const origin = getSiteBaseUrl(request);
  return NextResponse.json(
    {
      handle: user.handle,
      ref_link: `${origin}/api/ref?ref=${encodeURIComponent(user.handle)}`,
      profile_link: `${origin}/creators/${encodeURIComponent(user.handle)}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
