// Server-side Meta Conversions API (CAPI) for the `Purchase` event. Complements the
// client-side Meta Pixel so paid-ad ROI is measurable even when the browser blocks the
// pixel or the user has ad blockers. Best-effort: failures are swallowed and NEVER
// block the order flow.
//
// Env (injected as Cloudflare Worker secrets / wrangler.jsonc `vars`; available at runtime via `process.env`):
//   META_PIXEL_ID       the Meta Pixel id (also used client-side)
//   META_ACCESS_TOKEN   a Meta Conversions API access token (system-user / business)
// When either is missing, this is a no-op.

const META_PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";

type CapIOrder = {
  order_id: string;
  pricing: { total_cents: number; currency?: string };
  customer?: { email?: string };
};

export async function sendMetaCapiPurchase(order: CapIOrder, request?: Request): Promise<void> {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return;
  const { createHash } = await import("node:crypto");
  const value = (order.pricing?.total_cents || 0) / 100;
  const currency = (order.pricing?.currency || "USD").toUpperCase();

  const userData: Record<string, unknown> = {};
  const email = order.customer?.email?.trim().toLowerCase();
  if (email) userData.em = [createHash("sha256").update(email).digest("hex")];
  if (request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
    const ua = request.headers.get("user-agent") || undefined;
    const fbp = request.headers.get("fbp") || undefined;
    const fbc = request.headers.get("fbc") || undefined;
    if (ip) userData.client_ip_address = ip;
    if (ua) userData.client_user_agent = ua;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
  }

  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `ord_${order.order_id}`,
    action_source: "website",
    event_source_url: process.env.SITE_URL || "https://desmake.com",
    user_data: userData,
    custom_data: { value, currency, order_id: order.order_id },
  };

  await fetch(
    `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
}
