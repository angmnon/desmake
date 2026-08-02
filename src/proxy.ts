import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (R2/M9). The exported function must
 * be named `proxy`, and the `runtime` config option no longer exists — proxy always
 * runs on the Node.js runtime.
 *
 * SCOPE (R2/H9): this is a UX fast-path, NOT a security boundary.
 * It only checks whether a session cookie is *present* so signed-out visitors get
 * bounced to /auth instead of watching a page flash and then redirect. It deliberately
 * does NOT validate the token, because the session store lives in the route-handler
 * module graph and Next explicitly documents proxy as unsuitable for authorization.
 *
 * Real enforcement lives where the data does: every protected route handler calls
 * `getSession()` and returns 401/404 on its own (see src/app/api/**). A forged
 * `dm_session=whatever` cookie gets past this file and then fails at the API, which
 * is the only place that can actually leak anything.
 */

// Pages that require an authenticated session.
const PROTECTED_PAGE_PREFIXES = ["/orders", "/account"];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPage(pathname)) return NextResponse.next();

  const token = req.cookies.get("dm_session")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // API routes are intentionally NOT matched here: they authenticate themselves and
  // must return a real 401 from the handler rather than a cookie-presence guess.
  matcher: ["/orders/:path*", "/account/:path*"],
};
