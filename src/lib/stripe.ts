// Stripe client singleton.
//
// Credentials are baked into the container image as ENV (Cloudflare Containers do
// NOT inherit Worker `secret_text`/`vars`), same pattern as R2 and D1.
//   - STRIPE_SECRET_KEY                  server-side API key (sk_live_... / sk_test_...)
//   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY client-side key (inlined at build time)
//   - STRIPE_WEBHOOK_SECRET              for verifying /api/payments/webhook signatures

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

export const STRIPE_ENABLED = Boolean(secretKey);

// `new Stripe(key)` uses the account's default API version — no need to pin.
export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
