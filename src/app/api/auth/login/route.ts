import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSession, findUserByEmail, verifyPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const payload = (body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: { code: "validation", message: "A valid email is required" } }, { status: 400 });
  }
  if (!password || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: { code: "validation", message: "Password must be 6–128 characters" } }, { status: 400 });
  }

  // Real credential check against the persisted account — no magic emails.
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Incorrect email or password" } },
      { status: 401 },
    );
  }

  const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = createSession(sessionUser);

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
