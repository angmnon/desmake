import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSession, findUserByEmailAsync, verifyPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  // WAF-style throttle on auth: blunt credential-stuffing / brute force.
  const rl = rateLimit(`${clientIp(request)}:auth`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts — try again later" } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

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

  // C-1 fix: look the account up in D1 when this isolate's cache misses. The old
  // synchronous lookup only saw users created in this very isolate, so every
  // returning customer got "Incorrect email or password" and could never order.
  const user = await findUserByEmailAsync(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Incorrect email or password" } },
      { status: 401 },
    );
  }

  const sessionUser = { id: user.id, email: user.email, name: user.name, handle: user.handle, role: user.role, emailVerified: user.emailVerified, sessionEpoch: user.sessionEpoch ?? 0 };
  const token = createSession(sessionUser);

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
