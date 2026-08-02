import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  destroySession(request.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  // Same attributes as when it was set, otherwise the browser keeps the old cookie.
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
