import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verify";
import { markUserVerified, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  // C-2/M-4: honour a `next` target so the buyer lands back on checkout instead of
  // a dead end. Only same-site relative paths are allowed (open-redirect guard).
  const nextRaw = url.searchParams.get("next") || "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!token) {
    return new NextResponse(htmlMessage("Missing verification token.", false, "/"), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const userId = await consumeVerificationToken(token);
  if (!userId) {
    return new NextResponse(htmlMessage("This verification link is invalid or has expired.", false, "/"), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const user = await markUserVerified(userId);

  const res = new NextResponse(
    htmlMessage("Your email is confirmed — you're all set to order.", true, next),
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );

  // C-2 fix (the important half): re-issue the session cookie with emailVerified=true.
  // The old handler only wrote D1 and told the user to "close this tab and sign in" —
  // but the signed token still carried the stale `emailVerified:false` snapshot, so the
  // gate kept returning 403 no matter how many times they refreshed. Combined with
  // getSessionAsync() (which reads the live row) this removes the deadlock entirely.
  if (user) {
    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      role: user.role,
      emailVerified: true,
      sessionEpoch: user.sessionEpoch ?? 0,
    };
    res.cookies.set(SESSION_COOKIE, createSession(sessionUser), sessionCookieOptions());
  }

  return res;
}

function htmlMessage(msg: string, ok: boolean, href: string): string {
  const color = ok ? "#137333" : "#b3261e";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Desmake Email Verification</title></head><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f7f6f3"><div style="text-align:center;max-width:440px;padding:32px"><div style="font-size:40px;color:${color}">${ok ? "✓" : "!"}</div><h2 style="color:#0c0c0d">${msg}</h2><p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#0c0c0d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${ok ? "Continue" : "Return to Desmake"}</a></p><p style="color:#555"><a href="/" style="color:#0c0c0d">Go to homepage</a></p></div></body></html>`;
}
