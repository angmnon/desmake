import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

// TEMPORARY endpoint to send real outreach emails (founding-creator re-save
// notice) through the verified Cloudflare Email Sending channel. Key-gated and
// only used to dispatch the 2 real founder notifications. Remove this route +
// the OUTREACH_KEY var once the send is done.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-outreach-key");
  if (key !== process.env.OUTREACH_KEY) return new Response("forbidden", { status: 403 });

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ delivered: false, detail: "invalid json body" }, { status: 400 });
  }
  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return NextResponse.json({ delivered: false, detail: "missing to/subject/html" }, { status: 400 });
  }

  try {
    const res = await sendEmail(to, subject, html);
    return NextResponse.json({
      delivered: res.delivered,
      detail: res.delivered ? "sent via EMAIL binding" : "sendEmail returned false",
    });
  } catch (e: any) {
    return NextResponse.json({ delivered: false, detail: e?.message || String(e) });
  }
}
