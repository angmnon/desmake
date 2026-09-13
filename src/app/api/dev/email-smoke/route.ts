import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// TEMPORARY diagnostic endpoint to verify Cloudflare Email Sending.
// Exercises the exact legacy path used by src/lib/email.ts (EMAIL binding + cloudflare:email
// EmailMessage) and returns the real error so we can see WHY a send fails.
// Remove this route + the SMOKE_KEY var once verification is done.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-smoke-key");
  if (key !== process.env.SMOKE_KEY) return new Response("forbidden", { status: 403 });

  const to = req.nextUrl.searchParams.get("to");
  if (!to) return new Response("missing ?to=", { status: 400 });

  const env: any = (getCloudflareContext() as any)?.env ?? {};
  const binding = env.EMAIL;
  if (!binding) {
    return NextResponse.json({ delivered: false, detail: "EMAIL binding absent in Worker env" });
  }

  try {
    const cfEmailModule = ["cloudflare", "email"].join(":");
    const mod: any = await import(/* webpackIgnore: true */ cfEmailModule);
    const EmailMessage = mod?.EmailMessage;
    if (!EmailMessage) {
      return NextResponse.json({ delivered: false, detail: "cloudflare:email.EmailMessage unavailable" });
    }
    const from = process.env.EMAIL_FROM || "Desmake <no-reply@desmake.com>";
    const raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: Desmake email smoke test`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `If you receive this, Cloudflare Email Sending works.`,
    ].join("\r\n");
    await binding.send(new EmailMessage(from, to, raw));
    return NextResponse.json({ delivered: true, detail: "sent via EMAIL binding" });
  } catch (e: any) {
    return NextResponse.json({ delivered: false, detail: e?.message || String(e) });
  }
}
