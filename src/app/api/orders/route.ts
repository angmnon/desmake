import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unitPriceCents, computeTotals, variantsFor } from "@/lib/data";
import { findListingById } from "@/lib/catalog";
import { ordersStore, newId } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";

// NOTE: no `export const runtime = "edge"`. These handlers read the in-memory session
// and order stores off `globalThis`; on the edge runtime every function gets its own
// isolate, so the session written by /api/auth/login would not be visible here (R2/C1).

const MAX_QTY = 99;
const MAX_ITEMS = 50;

type LineItem = {
  listing_id: string;
  title: string;
  adapter: string;
  variant: string;
  quantity: number;
  unit_price_cents: number;
};

export async function POST(request: NextRequest) {
  // Order creation writes PII and money — require an authenticated session.
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to place an order" } }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Invalid JSON body" } }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: { code: "validation", message: "items array must not be empty" } }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: { code: "validation", message: `At most ${MAX_ITEMS} line items` } }, { status: 400 });
  }

  const lineItems: LineItem[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  items.forEach((raw: unknown, index: number) => {
    const it = (raw ?? {}) as { listing_id?: unknown; adapter?: unknown; variant?: unknown; quantity?: unknown };

    if (typeof it.listing_id !== "string") {
      rejected.push({ index, reason: "listing_id must be a string" });
      return;
    }
    if (
      typeof it.quantity !== "number" ||
      !Number.isFinite(it.quantity) ||
      !Number.isInteger(it.quantity) ||
      it.quantity < 1 ||
      it.quantity > MAX_QTY
    ) {
      rejected.push({ index, reason: `quantity must be an integer between 1 and ${MAX_QTY}` });
      return;
    }

    // Resolves seeded catalog designs AND designs published from Studio (R2/H8).
    const listing = findListingById(it.listing_id);
    if (!listing) {
      rejected.push({ index, reason: "unknown listing_id" });
      return;
    }

    const adapterId = typeof it.adapter === "string" ? it.adapter : "";
    // R2/H3: the adapter must actually be offered by this listing. Without this check a
    // crafted request could buy a `print3d`-only design as a `sticker` and pay $12
    // instead of $68. There is deliberately no default adapter — an absent or unknown
    // adapter is a client bug, not something to silently guess at.
    if (!listing.adapters.includes(adapterId)) {
      rejected.push({ index, reason: `adapter must be one of: ${listing.adapters.join(", ")}` });
      return;
    }

    const variant = typeof it.variant === "string" ? it.variant : "";
    const allowedVariants = variantsFor(adapterId);
    if (allowedVariants.length > 0 && !allowedVariants.includes(variant)) {
      rejected.push({ index, reason: `variant must be one of: ${allowedVariants.join(", ")}` });
      return;
    }

    // Price is ALWAYS derived server-side; any client-supplied amount is ignored.
    const unit = unitPriceCents(listing, adapterId, variant);
    if (unit === null) {
      rejected.push({ index, reason: "could not price this configuration" });
      return;
    }

    lineItems.push({
      listing_id: listing.id,
      title: listing.title,
      adapter: adapterId,
      variant,
      quantity: it.quantity,
      unit_price_cents: unit,
    });
  });

  // R2/C4: previously invalid lines were silently dropped and the rest was charged.
  // A partially-priced order is never what the buyer saw, so reject the whole request
  // and tell the client exactly which line failed.
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "validation",
          message: "One or more line items are invalid",
          details: rejected,
        },
      },
      { status: 400 },
    );
  }

  const totals = computeTotals(lineItems.map((l) => ({ priceCents: l.unit_price_cents, qty: l.quantity })));

  const customerRaw = (body.customer ?? {}) as { email?: unknown; name?: unknown };
  const shippingRaw = (body.shipping ?? {}) as { address?: unknown; method?: unknown };
  const now = Date.now();

  const order = {
    order_id: newId("ord"),
    user_id: user.id,
    status: "paid",
    items: lineItems,
    customer: {
      email: typeof customerRaw.email === "string" && customerRaw.email ? customerRaw.email.slice(0, 254) : user.email,
      name: typeof customerRaw.name === "string" && customerRaw.name ? customerRaw.name.slice(0, 120) : user.name,
    },
    shipping: {
      address: typeof shippingRaw.address === "string" ? shippingRaw.address.slice(0, 300) : null,
      method: shippingRaw.method === "express" ? "express" : "standard",
      cost_cents: totals.shippingCents,
    },
    pricing: {
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      shipping_cents: totals.shippingCents,
      total_cents: totals.totalCents,
      currency: "USD",
    },
    manufacturing: {
      status: "routing",
      facility_id: null as string | null,
      tracking: null as string | null,
      lead_time_days: 7,
      estimated_delivery_min: 5,
      estimated_delivery_max: 9,
    },
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    _created_ts: now,
    history: [
      { status: "paid", note: "Payment confirmed", ts: new Date(now).toISOString() },
      { status: "routing", note: "Matching to nearest manufacturer", ts: new Date(now).toISOString() },
    ],
  };

  ordersStore().set(order.order_id, order);

  return NextResponse.json(
    {
      order_id: order.order_id,
      status: order.status,
      total: totals.totalCents,
      manufacturing: order.manufacturing,
      created_at: order.created_at,
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view orders" } }, { status: 401 });
  }

  const mine = Array.from(ordersStore().values())
    .filter((o) => o.user_id === user.id)
    .sort((a, b) => (b._created_ts || 0) - (a._created_ts || 0))
    .map((o) => ({
      order_id: o.order_id,
      status: o.manufacturing?.status ?? o.status,
      total_cents: o.pricing?.total_cents ?? 0,
      items: o.items,
      created_at: o.created_at,
    }));

  return NextResponse.json({ orders: mine }, { headers: { "Cache-Control": "no-store" } });
}
