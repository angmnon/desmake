// Stripe client singleton.
//
// Credentials come from Cloudflare Worker secrets / wrangler.jsonc `vars`
// (OpenNext maps the Worker env to `process.env` at runtime).
//   - STRIPE_SECRET_KEY                  server-side API key (sk_live_... / sk_test_...)
//   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY client-side key (inlined at build time)
//   - STRIPE_WEBHOOK_SECRET              for verifying /api/payments/webhook signatures

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

export const STRIPE_ENABLED = Boolean(secretKey);

// `new Stripe(key)` uses the account's default API version — no need to pin.
export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

// SEC-PAY-KEYS: the publishable key is needed on the CLIENT (Stripe.js). `NEXT_PUBLIC_*`
// would have to be inlined at BUILD time, which the deploy pipeline never sets — so the
// browser got an empty string and the whole payment UI collapsed ("Payment is not
// configured"). Instead read a runtime Worker env var (set via `wrangler secret put
// STRIPE_PUBLISHABLE_KEY`); the /api/payments route returns it in `publishable_key`
// and StripeCheckout uses that (see StripeCheckout.tsx). Falls back to the build-time
// var for local dev. The secret key stays server-only.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
