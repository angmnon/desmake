import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createGuestUser, createSession, getSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * Provision a per-browser anonymous identity.
 *
 * R2/C5: the client used to call POST /api/auth/login with a hard-coded
 * `demo@desmake.app`, which made every visitor the *same* user and leaked orders
 * across visitors. This endpoint hands out a distinct identity per browser instead,
 * so the demo still works without a sign-in wall but order scoping is real.
 *
 * Runs on the Node.js runtime (no `runtime = "edge"`) so it shares the in-memory
 * session store with every other route — see the note in src/lib/session.ts.
 */
export async function POST(request: NextRequest) {
  // Already have a valid session? Keep it — never rotate an active identity.
  const existing = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const user = createGuestUser();
  const token = createSession(user);

  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
