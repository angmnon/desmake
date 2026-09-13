// Workers-native Stripe REST client.
//
// We deliberately do NOT use the official `stripe` Node SDK for network calls.
// Inside the Cloudflare Worker runtime its HTTP layer can fall back to Node's
// `https` agent (which is unavailable here) and simply hang forever on
// `paymentIntents.create` / `.retrieve` — surfacing to clients as a
// "Could not start the payment" timeout. A direct `fetch` to the Stripe REST
// API is reliable in Workers and lets us enforce a hard timeout so failures
// surface fast instead of hanging the request.

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_BASE = "https://api.stripe.com";
const REQ_TIMEOUT_MS = 25000;

export type StripeIntent = {
  id: string;
  client_secret: string | null;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
};

async function stripeRequest(
  method: string,
  path: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(STRIPE_BASE + path, {
      method,
      headers: {
        Authorization: "Bearer " + STRIPE_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params ? new URLSearchParams(params).toString() : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function createPaymentIntent(opts: {
  amount: number;
  currency: string;
  receiptEmail?: string;
  metadata: Record<string, string>;
}): Promise<StripeIntent> {
  const params: Record<string, string> = {
    amount: String(opts.amount),
    currency: opts.currency,
    "automatic_payment_methods[enabled]": "true",
  };
  for (const [k, v] of Object.entries(opts.metadata)) {
    params["metadata[" + k + "]"] = v;
  }
  if (opts.receiptEmail) params["receipt_email"] = opts.receiptEmail;

  const { ok, status, json } = await stripeRequest("POST", "/v1/payment_intents", params);
  if (!ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 300);
    throw new Error("Stripe " + status + ": " + msg);
  }
  return json as StripeIntent;
}

export async function retrievePaymentIntent(id: string): Promise<StripeIntent | null> {
  const { ok, json } = await stripeRequest("GET", "/v1/payment_intents/" + id);
  if (!ok) return null;
  return json as StripeIntent;
}
