import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { upsertUser, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const payload = (body ?? {}) as { email?: unknown; name?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: { code: "validation", message: "A valid email is required" } }, { status: 400 });
  }
  // Reserved namespace for auto-provisioned guest identities (see /api/auth/guest).
  if (email.endsWith("@guest.desmake.local")) {
    return NextResponse.json({ error: { code: "validation", message: "That email domain is reserved" } }, { status: 400 });
  }

  const user = upsertUser(email, name);
  const token = createSession(user);

  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
