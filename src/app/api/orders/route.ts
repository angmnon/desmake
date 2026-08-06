import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  unitPriceForSku,
  variantDeltaForSku,
  adapterIdForSku,
  adapterDefaultSku,
  variantsForSku,
  computeOrderTotals,
  regionFromCountry,
  type Region,
} from "@/lib/data";
import {
  SKU_BY_ID,
  retailCents as skuRetailCents,
  salePriceCents as skuSaleCents,
  freightCents as skuFreightCents,
} from "@/lib/pricing";
import { findListingByIdAsync } from "@/lib/catalog";
import { ordersStore, newId, persistOrder, findPublishedDesignByIdAsync } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";

// NOTE: no `export const runtime = "edge"`. These handlers read the in-memory session
// and order stores off `globalThis`; on the edge runtime every function gets its own
// isolate, so the session written by /api/auth/login would not be visible here (R2/C1).

const MAX_QTY = 99;
const MAX_ITEMS = 50;

type LineItem = {
  listing_id: string;
  listing_slug?: string;
  title: string;
  adapter: string;
  variant: string;
  quantity: number;
  unit_price_cents: number;
  // M3: 分成链路
  sku?: string;
  creator_id?: string;
  royalty_rate?: number;
  net_cents?: number;
  royalty_cents?: number;
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

  // 目的地 → 税率档位（EU 19% / US 7% / 其他 0%）。平台代缴，计入售价，不进分成基数。
  const regionRaw = typeof (body as { region?: unknown }).region === "string" ? (body as { region: string }).region : "";
  const countryRaw = typeof (body as { country?: unknown }).country === "string" ? (body as { country: string }).country : "";
  const region: Region =
    regionRaw === "EU" || regionRaw === "US" ? (regionRaw as Region) : regionFromCountry(countryRaw);

  // 跨实例解析：先把本次订单涉及的 listing 一次性解析好（内存未命中回落 D1），
  // 否则 max_instances=3 时「刚发布的设计下单报 unknown listing_id」。
  const requestedIds = Array.from(
    new Set(
      items
        .map((raw: unknown) => (raw as { listing_id?: unknown })?.listing_id)
        .filter((v: unknown): v is string => typeof v === "string"),
    ),
  );
  const resolved = new Map<
    string,
    { listing: Awaited<ReturnType<typeof findListingByIdAsync>>; pub: Awaited<ReturnType<typeof findPublishedDesignByIdAsync>> }
  >();
  for (const id of requestedIds) {
    const listing = await findListingByIdAsync(id);
    const pub = listing ? await findPublishedDesignByIdAsync(listing.id) : undefined;
    resolved.set(id, { listing, pub });
  }

  items.forEach((raw: unknown, index: number) => {
    const it = (raw ?? {}) as { listing_id?: unknown; adapter?: unknown; sku?: unknown; variant?: unknown; quantity?: unknown };

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

    // Resolves seeded catalog designs AND designs published from Studio (R2/H8),
    // 内存未命中时已在上面回落过 D1。
    const hit = resolved.get(it.listing_id);
    const listing = hit?.listing;
    if (!listing) {
      rejected.push({ index, reason: "unknown listing_id" });
      return;
    }

    const pub = hit?.pub;

    // ── M3: 解析 SKU（具体商品） ──
    // 允许的商品集合 = 发布时勾选的 selectedProducts，或旧数据由 adapters 推导的 family 默认 SKU。
    const allowedSkus = pub && pub.selectedProducts && pub.selectedProducts.length > 0
      ? pub.selectedProducts.map((p) => p.sku)
      : listing.adapters.map((a) => adapterDefaultSku(a) ?? "").filter(Boolean);

    let sku = typeof it.sku === "string" ? it.sku : "";
    if (!sku || !allowedSkus.includes(sku)) {
      // 兼容旧下单：传 adapter 不传 sku → 用 family 默认 SKU
      const reqAdapter = typeof it.adapter === "string" ? it.adapter : "";
      sku = adapterDefaultSku(reqAdapter) ?? allowedSkus[0] ?? "";
    }
    if (!sku || !SKU_BY_ID[sku]) {
      rejected.push({ index, reason: "unknown product" });
      return;
    }

    const requestedAdapter = typeof it.adapter === "string" ? it.adapter : "";
    const adapterId = requestedAdapter || adapterIdForSku(sku) || "";
    // R2/H3: 当显式传了 adapter 时，必须确为该 listing 提供的适配器（防越权低价购买）。
    if (requestedAdapter && !listing.adapters.includes(requestedAdapter)) {
      rejected.push({ index, reason: `adapter must be one of: ${listing.adapters.join(", ")}` });
      return;
    }

    const variant = typeof it.variant === "string" ? it.variant : "";
    const allowedVariants = variantsForSku(sku);
    if (allowedVariants.length > 0 && !allowedVariants.includes(variant)) {
      rejected.push({ index, reason: `variant must be one of: ${allowedVariants.join(", ")}` });
      return;
    }

    // 价格始终服务端计算：售价 = SKU 建议零售价(含运费×1.15) + variant 增量；
    // 按 region 计平台代缴税后即为实际收取单价。客户端传的金额一律忽略。
    const delta = variant ? variantDeltaForSku(sku, variant) : 0;
    if (delta === null) {
      rejected.push({ index, reason: "could not price this configuration" });
      return;
    }
    const skuObj = SKU_BY_ID[sku];
    const unit = unitPriceForSku(sku, variant);
    if (unit === null) {
      rejected.push({ index, reason: "could not price this configuration" });
      return;
    }
    const saleUnit = skuSaleCents(skuObj, region) + delta; // 含平台代缴税

    // ── M3: 创作者分成 ──
    // 净价基数 N = 零售不含税 − 运费（与 region 无关）；royalty = round(N × rate)。
    const rate =
      pub?.royaltyRate && pub.royaltyRate >= 0.1 && pub.royaltyRate <= 0.5 ? pub.royaltyRate : 0;
    const net = skuRetailCents(skuObj) - skuFreightCents(skuObj);
    const royaltyCentsVal = rate > 0 ? Math.round(net * rate) : 0;

    lineItems.push({
      listing_id: listing.id,
      listing_slug: listing.slug,
      title: listing.title,
      adapter: adapterId,
      variant,
      quantity: it.quantity,
      unit_price_cents: saleUnit,
      sku,
      creator_id: pub?.user_id,
      royalty_rate: rate,
      net_cents: net,
      royalty_cents: royaltyCentsVal,
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

  // 运费（首件全价 + 续件递减，按重量级）与税费（平台代缴，按 region）由引擎统一计算。
  const totals = computeOrderTotals(
    lineItems.map((l) => ({ sku: l.sku ?? "", qty: l.quantity, variant: l.variant })),
    region,
  );

  const customerRaw = (body.customer ?? {}) as { email?: unknown; name?: unknown };
  const shippingRaw = (body.shipping ?? {}) as { address?: unknown; method?: unknown };
  const now = Date.now();

  const order = {
    order_id: newId("ord"),
    user_id: user.id,
    // Real checkout lifecycle: an order is created *pending payment* and only
    // becomes "paid" after /api/payments/confirm (or a gateway callback once a
    // provider is wired in). No more auto-paid demo orders.
    status: "pending",
    payment: {
      ref: newId("pay"),
      method: null as string | null,
      paid_at: null as string | null,
      payment_intent_id: null as string | null,
    },
    items: lineItems,
    customer: {
      email: typeof customerRaw.email === "string" && customerRaw.email ? customerRaw.email.slice(0, 254) : user.email,
      name: typeof customerRaw.name === "string" && customerRaw.name ? customerRaw.name.slice(0, 120) : user.name,
    },
    shipping: {
      address: typeof shippingRaw.address === "string" ? shippingRaw.address.slice(0, 300) : null,
      method: shippingRaw.method === "express" ? "express" : "standard",
      cost_cents: totals.shippingCents,
      region,
    },
    pricing: {
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      shipping_cents: totals.shippingCents,
      total_cents: totals.totalCents,
      currency: "USD",
    },
    manufacturing: {
      status: "pending",
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
      { status: "pending", note: "Order created — awaiting payment", ts: new Date(now).toISOString() },
    ],
  };

  ordersStore().set(order.order_id, order);
  void persistOrder(order).catch(() => {});

  return NextResponse.json(
    {
      order_id: order.order_id,
      payment_ref: order.payment.ref,
      status: order.status,
      total: totals.totalCents,
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
      status: o.status === "pending" ? "pending" : (o.manufacturing?.status ?? o.status),
      payment_ref: o.payment?.ref ?? null,
      total_cents: o.pricing?.total_cents ?? 0,
      items: o.items,
      created_at: o.created_at,
    }));

  return NextResponse.json({ orders: mine }, { headers: { "Cache-Control": "no-store" } });
}
