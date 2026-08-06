import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verify";
import { markUserVerified } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new NextResponse(htmlMessage("Missing verification token.", false), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const userId = await consumeVerificationToken(token);
  if (!userId) {
    return new NextResponse(htmlMessage("This verification link is invalid or has expired.", false), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  await markUserVerified(userId);
  return new NextResponse(htmlMessage("Your email is confirmed. You can close this tab and sign in.", true), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function htmlMessage(msg: string, ok: boolean): string {
  const color = ok ? "#137333" : "#b3261e";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Desmake Email Verification</title></head><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f7f6f3"><div style="text-align:center;max-width:440px;padding:32px"><div style="font-size:40px;color:${color}">${ok ? "✓" : "!"}</div><h2 style="color:#0c0c0d">${msg}</h2><p style="color:#555"><a href="/" style="color:#0c0c0d">Return to Desmake</a></p></div></body></html>`;
}
