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
import {
  ordersStore,
  newId,
  persistOrder,
  findPublishedDesignByIdAsync,
  listOrdersForUserAsync,
  findOrderByIdempotencyKey,
} from "@/lib/stores";
import {
  getSessionAsync,
  SESSION_COOKIE,
  resolveHandleToUserIdAsync,
  getUserByIdAsync,
  isEmailVerificationSatisfied,
  runDurable,
} from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { readAttributionFromRequest } from "@/lib/tracking";
import { effectiveRoyaltyRate } from "@/lib/royalty";

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
  referrer_id?: string;
};

export async function POST(request: NextRequest) {
  // Order creation writes PII and money — require an authenticated session.
  // C-2 fix: use the D1-backed async session so `emailVerified` reflects the live
  // record. The synchronous getSession() reads the value frozen into the token at
  // sign-in, so a buyer who verified their email was still rejected with 403 until
  // they logged in again — an action C-1 had made impossible.
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to place an order" } }, { status: 401 });
  }
  // H-8: require a verified email before placing an order (when the flag is on).
  if (!isEmailVerificationSatisfied(user)) {
    return NextResponse.json(
      { error: { code: "email_unverified", message: "Please verify your email address to place an order." } },
      { status: 403 },
    );
  }

  // WAF-style throttle on order creation (per authenticated account).
  const ordRl = rateLimit(`${user.id}:orders`, 20);
  if (!ordRl.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many orders — please slow down" } },
      { status: 429, headers: { "Retry-After": String(ordRl.retryAfter) } },
    );
  }

  // M-UGC: referral attribution. The dm_ref cookie (set by /api/ref from a share
  // link) wins as last-click within 30 days; if absent, fall back to the buyer's
  // lifetime referred_by (set at registration via ?ref=). Anti-self-referral: a
  // person can never earn a commission by "referring" themselves.
  let referrerId: string | undefined;
  const refCookie = request.cookies.get("dm_ref")?.value;
  // C-1 fix: these lookups must reach D1 or referral attribution silently dies.
  if (refCookie) referrerId = await resolveHandleToUserIdAsync(refCookie);
  if (!referrerId) {
    const buyer = await getUserByIdAsync(user.id);
    // `referredBy` already stores the referrer's internal user id (register resolves
    // the ?ref= handle at sign-up), so it must NOT be run through the handle
    // resolver — that always returned undefined and silently killed this fallback.
    // Re-check the id still maps to a live account before trusting it.
    if (buyer?.referredBy && (await getUserByIdAsync(buyer.referredBy))) referrerId = buyer.referredBy;
  }
  if (referrerId === user.id) referrerId = undefined;

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
  //
  // H-7 fix: 税率档位此前完全由客户端 body 决定（`region` 字段被直接采信），买家只要
  // 不传或乱填 country 就会落到 DEFAULT(0%)，EU 订单因此漏收 19% 增值税（平台代缴却
  // 没收到钱，同时带来合规风险）。现在一律由「结构化收货国家 → Cloudflare GeoIP」
  // 推导，客户端传的 region 仅作无国家时的兼容兜底，不再能指定税率。
  const shipCountryRaw = (body.shipping as { country?: unknown } | undefined)?.country;
  const countryRaw =
    typeof (body as { country?: unknown }).country === "string"
      ? (body as { country: string }).country
      : typeof shipCountryRaw === "string"
        ? shipCountryRaw
        : "";
  const cfCountry = (request.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  // R2/M-3: GeoIP is authoritative; the client-supplied country is only a fallback for when
  // Cloudflare provides none (e.g. local dev). Previously the client value won, so a buyer
  // could declare a low/zero-tax destination to dodge destination VAT.
  const country = cfCountry || (countryRaw || "").trim().toUpperCase();
  const region: Region = regionFromCountry(country);

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

    // ── M-8: 仅允许已上架(published)的设计被购买 ──
    // draft / archived / sold_out 等状态必须拒绝下单；种子商品与未带 status 的
    // 旧数据视为 published（向后兼容，不影响现有在售商品）。
    if (pub && pub.status && pub.status !== "published") {
      rejected.push({ index, reason: "this design is not available for purchase" });
      return;
    }

    // ── M3: 解析 SKU（具体商品） ──
    // 允许的商品集合 = 发布时勾选的 selectedProducts，或旧数据由 adapters 推导的 family 默认 SKU。
    const hasCurated = Boolean(pub && pub.selectedProducts && pub.selectedProducts.length > 0);
    const allowedSkus = hasCurated
      ? (pub?.selectedProducts ?? []).map((p) => p.sku)
      : listing.adapters.map((a) => adapterDefaultSku(a) ?? "").filter(Boolean);

    let sku = typeof it.sku === "string" ? it.sku : "";
    if (!sku || !allowedSkus.includes(sku)) {
      const reqAdapter = typeof it.adapter === "string" ? it.adapter : "";
      // R2/M-2: when the listing curates `selectedProducts`, the adapter's family-default
      // SKU is NOT necessarily offered. The old fallback blindly used it, so a client could
      // send an adapter (valid per listing.adapters) and buy a cheaper SKU outside the
      // published set. Only accept the family default if it is actually allowed; otherwise
      // reject rather than silently substituting a different product.
      const familyDefault = adapterDefaultSku(reqAdapter) ?? "";
      if (familyDefault && allowedSkus.includes(familyDefault)) {
        sku = familyDefault;
      } else if (!hasCurated && allowedSkus.length > 0) {
        // Legacy shape (no curated set): keep adapter-only orders working.
        sku = allowedSkus[0];
      } else {
        rejected.push({ index, reason: "unknown product" });
        return;
      }
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
    if (variant) {
      // R2-Low: a SKU with NO variants (e.g. the `home` family — mugs, blankets)
      // must reject any supplied variant. The old guard only checked membership
      // when the list was non-empty, so a client could send a 3D-print variant
      // (e.g. "PLA · Ivory") against a mug and be overcharged its delta.
      if (allowedVariants.length === 0) {
        rejected.push({ index, reason: "this product has no selectable variants" });
        return;
      }
      if (!allowedVariants.includes(variant)) {
        rejected.push({ index, reason: `variant must be one of: ${allowedVariants.join(", ")}` });
        return;
      }
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
    // Early Creator Program：有效分成比例 = max(设计比例, 档位地板)，封顶 0.50。
    const rate = effectiveRoyaltyRate(pub?.royaltyRate, pub?.creatorTier);
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
      referrer_id: referrerId,
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
  const shippingRaw = (body.shipping ?? {}) as {
    address?: unknown;
    method?: unknown;
    line1?: unknown;
    line2?: unknown;
    city?: unknown;
    state?: unknown;
    postalCode?: unknown;
    postal_code?: unknown;
    phone?: unknown;
  };
  const now = Date.now();

  // H-6: 结构化收货信息。此前只有一个 address 字符串且被硬截到 300 字符（长地址会把
  // 邮编/国家整段砍掉），也没有独立国家、城市、电话字段，国际订单无法报关与派送。
  // 旧客户端仍可只传 address 单串，这里会原样保留。
  const safeStr = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const shipLine1 = safeStr(shippingRaw.line1, 200);
  const shipLine2 = safeStr(shippingRaw.line2, 200);
  const shipCity = safeStr(shippingRaw.city, 120);
  const shipState = safeStr(shippingRaw.state, 120);
  const shipPostal = safeStr(shippingRaw.postalCode ?? shippingRaw.postal_code, 40);
  const shipPhone = safeStr(shippingRaw.phone, 40);
  const legacyAddress = safeStr(shippingRaw.address, 600);
  const shipCountryFinal = country || null;
  const composedAddress =
    [shipLine1, shipLine2, shipCity, shipState, shipPostal, shipCountryFinal].filter(Boolean).join(", ") ||
    legacyAddress;

  // P0-2: attach paid-acquisition attribution (UTM / click ids) to the order so
  // revenue can be tied back to the campaign that drove it.
  const attrib = readAttributionFromRequest(request);
  const acquisition = attrib.utm_source
    ? {
        source: attrib.utm_source,
        medium: attrib.utm_medium,
        campaign: attrib.utm_campaign,
        gclid: attrib.gclid,
        fbclid: attrib.fbclid,
        landing: attrib.landing_path,
      }
    : null;

  // M-9: 幂等键 —— 网络抖动或用户双击会创建多笔独立 pending 订单，若两笔都进入
  // 支付流程就是两笔真实扣款。带同一个 key 的重试直接回放首次创建的订单。
  const idempotencyKey =
    (request.headers.get("idempotency-key") || "").trim() ||
    (typeof (body as { idempotency_key?: unknown }).idempotency_key === "string"
      ? ((body as { idempotency_key: string }).idempotency_key || "").trim()
      : "");
  if (idempotencyKey) {
    // R2/M-1: consult D1 (the durable store) so a retry that lands on a different isolate
    // replays the original order instead of creating a second pending order (double charge).
    const existing = await findOrderByIdempotencyKey(user.id, idempotencyKey);
    if (existing) {
      return NextResponse.json(
        {
          order_id: existing.order_id,
          payment_ref: existing.payment?.ref ?? null,
          status: existing.status,
          total: existing.pricing?.total_cents ?? 0,
          created_at: existing.created_at,
          idempotent_replay: true,
        },
        { status: 200 },
      );
    }
  }

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
      address: composedAddress ? composedAddress.slice(0, 600) : null,
      line1: shipLine1,
      line2: shipLine2,
      city: shipCity,
      state: shipState,
      postal_code: shipPostal,
      country: shipCountryFinal,
      phone: shipPhone,
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
    referrer_id: referrerId ?? null,
    idempotency_key: idempotencyKey || null,
    acquisition,
    history: [
      { status: "pending", note: "Order created — awaiting payment", ts: new Date(now).toISOString() },
    ],
  };

  ordersStore().set(order.order_id, order);
  // H-9: register the write with the Workers runtime so it survives the response.
  // A bare `void persistOrder().catch(() => {})` is cancelled the moment the response
  // is returned, which is how orders could exist in one isolate's memory only.
  runDurable("persistOrder", persistOrder(order));

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
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view orders" } }, { status: 401 });
  }

  // H-1: read through D1. The previous implementation iterated the in-memory store
  // only, so orders created (and paid) on another isolate never appeared here.
  const all = await listOrdersForUserAsync(user.id);
  const mine = all.map((o) => ({
    order_id: o.order_id,
    status: o.status === "pending" ? "pending" : (o.manufacturing?.status ?? o.status),
    payment_ref: o.payment?.ref ?? null,
    total_cents: o.pricing?.total_cents ?? 0,
    items: o.items,
    created_at: o.created_at,
  }));

  return NextResponse.json({ orders: mine }, { headers: { "Cache-Control": "no-store" } });
}
