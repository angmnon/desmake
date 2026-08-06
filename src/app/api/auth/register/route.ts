import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createUser, createSession, findUserByEmail, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { createVerificationToken } from "@/lib/verify";
import { sendVerificationEmail } from "@/lib/email";
import { getSiteBaseUrl } from "@/lib/url";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const payload = (body ?? {}) as { email?: unknown; password?: unknown; name?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: { code: "validation", message: "A valid email is required" } }, { status: 400 });
  }
  if (!password || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: { code: "validation", message: "Password must be 6–128 characters" } }, { status: 400 });
  }
  if (findUserByEmail(email)) {
    return NextResponse.json(
      { error: { code: "conflict", message: "An account with this email already exists — sign in instead" } },
      { status: 409 },
    );
  }

  try {
    const user = createUser(email, name, password);
    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified };
    const token = createSession(sessionUser);

    // Email confirmation: create a verification token and send it. When no email
    // provider is configured we surface the link in the response so the flow is
    // still testable (dev only — never log tokens in production).
    let verificationLink: string | undefined;
    try {
      const vtoken = await createVerificationToken(user.id);
      const baseUrl = getSiteBaseUrl(request);
      const sent = await sendVerificationEmail(baseUrl, user.email, vtoken);
      if (!sent.delivered) verificationLink = sent.link;
    } catch (e) {
      console.error("[register] verification email failed:", e instanceof Error ? e.message : e);
    }

    const res = NextResponse.json(
      { user: sessionUser, email_verification_link: verificationLink },
      { status: 201 },
    );
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: { code: "conflict", message: err instanceof Error ? err.message : "Registration failed" } },
      { status: 409 },
    );
  }
}
