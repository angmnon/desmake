// Email sending abstraction.
//
// C-3 fix (critical): the previous implementation called the Cloudflare `send_email`
// binding with a plain object — `EMAIL.send({ from, to, subject, html, text })`. That
// is not the binding's API: it expects a real MIME message via
// `new EmailMessage(from, to, rawMime)` from `cloudflare:email`. Every call therefore
// threw, the error was swallowed by a `catch`, and **no verification or order-confirmation
// email was ever delivered** — which, with REQUIRE_EMAIL_VERIFICATION on, meant buyers
// physically could not complete the sign-up gate and no order could be placed.
//
// Transport order:
//   1. Cloudflare Email Sending binding (correct EmailMessage + MIME), when bound.
//   2. Resend HTTP API, when RESEND_API_KEY is set (`wrangler secret put RESEND_API_KEY`).
//
// Both are best-effort and never block checkout, but failures are now logged loudly.

import { getCloudflareContext } from "@opennextjs/cloudflare";

function getEnvEmail(): any {
  const env = (getCloudflareContext() as any)?.env ?? {};
  return env.EMAIL;
}

// The native binding cannot be detected at module load (it lives in the Worker
// runtime env, not process.env), so expose a runtime check for the health route.
export function EMAIL_ENABLED(): boolean {
  return Boolean(getEnvEmail()) || Boolean(process.env.RESEND_API_KEY);
}

function parseFrom(raw: string | undefined): { email: string; name?: string } {
  const s = (raw || "Desmake <no-reply@desmake.com>").trim();
  const m = s.match(/^(.*?)\s*<(.+?)>$/);
  if (m && m[2]) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: s };
}

const FROM = parseFrom(process.env.EMAIL_FROM);
const FROM_FIELD = FROM.name ? { email: FROM.email, name: FROM.name } : FROM.email;
const FROM_HEADER = FROM.name ? `"${sanitizeHeader(FROM.name)}" <${FROM.email}>` : FROM.email;

/** Strip CR/LF so a crafted value can never inject extra MIME headers. */
function sanitizeHeader(v: string): string {
  return String(v).replace(/[\r\n]+/g, " ").trim();
}

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/** RFC-2047 encoded-word so non-ASCII subjects survive transport untouched. */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${b64(sanitizeHeader(subject))}?=`;
}

/** Build a multipart/alternative MIME message (text + html). */
function buildMime(from: string, to: string, subject: string, html: string, text: string): string {
  const boundary = `----=_Desmake_${Math.random().toString(36).slice(2)}`;
  const CRLF = "\r\n";
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(text).replace(/(.{76})/g, "$1" + CRLF),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(html).replace(/(.{76})/g, "$1" + CRLF),
    ``,
    `--${boundary}--`,
    ``,
  ].join(CRLF);
}

/** Transport 1 — Cloudflare Email Sending binding (correct API shape). */
async function sendViaCloudflare(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const binding = getEnvEmail();
  if (!binding) return false;
  try {
    // `cloudflare:email` is a Workers-runtime-only module with no Node/esbuild
    // resolution. Build the specifier from parts and keep it non-literal so neither
    // Next/webpack nor the OpenNext esbuild pass try to statically resolve & bundle
    // it (a literal `import("cloudflare:email")` makes `opennextjs-cloudflare build`
    // fail with "Could not resolve cloudflare:email"). At runtime inside a Worker the
    // dynamic import resolves to the native binding. `webpackIgnore` stops webpack
    // from emitting a literal require; the `.join(":")` keeps esbuild from folding the
    // specifier back into a literal it would then attempt to resolve.
    const cfEmailModule = ["cloudflare", "email"].join(":");
    const mod = (await import(/* webpackIgnore: true */ cfEmailModule)) as unknown as {
      EmailMessage?: new (from: string, to: string, raw: string) => unknown;
    };
    const EmailMessage = mod?.EmailMessage;
    if (!EmailMessage) return false;
    await binding.send(new EmailMessage(FROM_HEADER, to, buildMime(FROM_HEADER, to, subject, html, text)));
    return true;
  } catch (err) {
    console.error("[email] cloudflare send_email failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Transport 2 — Resend HTTP API (works from any runtime, no binding required). */
async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_HEADER,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] resend failed: ${res.status} ${detail.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] resend request failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

let emailWarned = false;

export async function sendEmail(to: string, subject: string, html: string): Promise<{ delivered: boolean }> {
  const text = html.replace(/<[^>]+>/g, "");

  if (await sendViaCloudflare(to, subject, html, text)) return { delivered: true };
  if (await sendViaResend(to, subject, html, text)) return { delivered: true };

  if (!emailWarned) {
    emailWarned = true;
    console.error(
      "[email] CRITICAL: no working email transport. Order confirmation and email " +
        "verification emails will NOT be delivered. Configure the `send_email` binding in " +
        "wrangler.jsonc with a verified sender domain, or set RESEND_API_KEY " +
        "(`wrangler secret put RESEND_API_KEY`).",
    );
  }
  return { delivered: false };
}

export async function sendVerificationEmail(baseUrl: string, email: string, token: string) {
  const link = `${baseUrl}/api/auth/verify?token=${token}`;
  const html = `<p>Welcome to Desmake. Please confirm your email address to activate your account:</p><p><a href="${link}">${link}</a></p><p>If you did not create this account you can ignore this email.</p>`;
  const r = await sendEmail(email, "Confirm your Desmake email", html);
  return { link, delivered: r.delivered };
}

// P1: transactional order email (confirmation + receipt). Best-effort — never blocks checkout.
type OrderEmailShape = {
  order_id: string;
  customer: { email?: string; name?: string };
  pricing: { total_cents: number; currency?: string };
  items: Array<{ title?: string; quantity?: number; unit_price_cents?: number }>;
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export async function sendOrderConfirmationEmail(order: OrderEmailShape): Promise<{ delivered: boolean }> {
  const email = order.customer?.email;
  if (!email) return { delivered: false };
  const total = ((order.pricing?.total_cents || 0) / 100).toFixed(2);
  const currency = order.pricing?.currency || "USD";
  const lines = (order.items || [])
    .map((it) => {
      const qty = it.quantity ?? 1;
      const lineTotal = (((it.unit_price_cents ?? 0) * qty) / 100).toFixed(2);
      return `<li>${escapeHtml(it.title || "Item")} × ${qty} — $${lineTotal}</li>`;
    })
    .join("");
  const html = `<h2>Thanks for your order, ${escapeHtml(order.customer?.name || "friend")}!</h2>
<p>Your Desmake order <strong>#${escapeHtml(order.order_id)}</strong> is confirmed and heading to production.</p>
<ul>${lines}</ul>
<p><strong>Total paid: $${total} ${currency}</strong></p>
<p>We'll email your tracking number once it ships.</p>`;
  return sendEmail(email, `Order confirmed — #${order.order_id}`, html);
}
