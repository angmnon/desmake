/**
 * Desmake 定价引擎 + 供应链成本表
 *
 * 数据来源：附件《中国供应链AI商品平台报价与定价清单.xlsx》（2026-08 检索，43 个 SKU / 10 大类）
 * 决策（2026-08-06 锁定）：
 *  - 商品粒度：保留 6 大类（tshirt/poster/card/phonecase/sticker/home），43 个 SKU 作为各 family 的 variant
 *  - 分成基数：净价 N = 系统售价 − 运费分摊 − 税费分摊；royalty = N × royaltyRate
 *  - 多件运费：首件按重量级全价 + 续件递减（SUBSEQUENT_FREIGHT_FACTOR）
 *  - 税费：平台代缴，计入售价；税率按目的地（EU 19% / US 7%）
 *  - 结算：月结 + 手动打款（M6 实现）
 *
 * 公式（与附件一致）：
 *   出厂成本($)   = 出厂成本@1件(¥) / USD_RMB
 *   国际运费($)   = 重量级对应运费
 *   加成倍数     = 按"出厂成本(不含运费)"匹配 MARKUP_TIERS
 *   建议零售价($) = 出厂成本 × 加成倍数 + 国际运费 × FREIGHT_PASS_THROUGH(1.15)
 */

export const PRICING_CONFIG = {
  USD_RMB: 7.2,
  // 国际直邮运费分级（中国→美/欧，不含税）；运费按 1.15 倍透传（覆盖打包耗材与操作）
  FREIGHT_PASS_THROUGH: 1.15,
  // 多件运费：续件系数（首件全价，续件 × 此系数）
  SUBSEQUENT_FREIGHT_FACTOR: 0.35,
  freightTiers: {
    light: { rmb: 15, label: "Light <100g" },
    medium: { rmb: 26, label: "Medium 100-500g" },
    heavy: { rmb: 42, label: "Heavy 500g-2kg" },
    oversize: { rmb: 68, label: "Oversize >2kg" },
  } as const,
  // 加成倍数（按出厂成本不含运费 $ 区间下界匹配）
  markupTiers: [
    { min: 0, mult: 5.5 },
    { min: 1, mult: 4.2 },
    { min: 3, mult: 3.2 },
    { min: 7, mult: 2.6 },
    { min: 15, mult: 2.2 },
    { min: 35, mult: 1.8 },
  ] as const,
  // 平台代缴税率（计入售价，不进分成基数）
  taxRates: {
    EU: 0.19,
    US: 0.07,
    DEFAULT: 0.0,
  } as const,
} as const;

export type WeightClass = keyof typeof PRICING_CONFIG.freightTiers; // light|medium|heavy|oversize
export type FamilyId = "tshirt" | "poster" | "card" | "phonecase" | "sticker" | "home";
export type Region = keyof typeof PRICING_CONFIG.taxRates; // EU|US|DEFAULT

export interface ProductSku {
  sku: string;
  family: FamilyId;
  name: string;
  process: string;
  weightClass: WeightClass;
  /** 出厂成本 @1件(¥) —— 零售定价成本基础 */
  costRMB_q1: number;
  /** 批量成本(¥)，供 B2B/批发与未来经济批量备货参考 */
  costRMB_q50: number;
  costRMB_q200: number;
  costRMB_q1000: number;
}

/** 附件 43 个 SKU，映射到 6 大类（family）下 */
export const PRODUCT_SKUS: ProductSku[] = [
  // ── poster（墙面艺术） ──
  { sku: "wallart-poster-a4", family: "poster", name: "Poster A4", process: "UV / digital paper print", weightClass: "medium", costRMB_q1: 3.5, costRMB_q50: 2.2, costRMB_q200: 1.5, costRMB_q1000: 1 },
  { sku: "wallart-poster-a3", family: "poster", name: "Poster A3", process: "UV / digital paper print", weightClass: "medium", costRMB_q1: 5.5, costRMB_q50: 3.5, costRMB_q200: 2.4, costRMB_q1000: 1.6 },
  { sku: "wallart-poster-a2", family: "poster", name: "Poster A2", process: "UV / digital paper print", weightClass: "heavy", costRMB_q1: 9, costRMB_q50: 6, costRMB_q200: 4.2, costRMB_q1000: 3 },
  { sku: "wallart-canvas-30", family: "poster", name: "Canvas Print 30x40cm", process: "Inkjet on stretched canvas", weightClass: "heavy", costRMB_q1: 25, costRMB_q50: 18, costRMB_q200: 14, costRMB_q1000: 11 },
  { sku: "wallart-canvas-40", family: "poster", name: "Canvas Print 40x60cm", process: "Inkjet on stretched canvas", weightClass: "heavy", costRMB_q1: 38, costRMB_q50: 28, costRMB_q200: 22, costRMB_q1000: 17 },
  { sku: "wallart-acrylic-30", family: "poster", name: "Acrylic Wall Art 30x40cm", process: "UV print on acrylic panel", weightClass: "heavy", costRMB_q1: 45, costRMB_q50: 34, costRMB_q200: 27, costRMB_q1000: 21 },
  { sku: "wallart-aluminum-30", family: "poster", name: "Aluminium Wall Art 30x40cm", process: "UV print on aluminium composite", weightClass: "heavy", costRMB_q1: 40, costRMB_q50: 30, costRMB_q200: 24, costRMB_q1000: 19 },

  // ── tshirt（服饰） ──
  { sku: "apparel-tee", family: "tshirt", name: "T-Shirt (Cotton Crewneck)", process: "DTG direct-to-garment", weightClass: "medium", costRMB_q1: 26, costRMB_q50: 20, costRMB_q200: 16, costRMB_q1000: 13 },
  { sku: "apparel-hoodie", family: "tshirt", name: "Hoodie", process: "DTG direct-to-garment", weightClass: "heavy", costRMB_q1: 68, costRMB_q50: 54, costRMB_q200: 45, costRMB_q1000: 38 },
  { sku: "apparel-sweatshirt", family: "tshirt", name: "Sweatshirt", process: "DTG direct-to-garment", weightClass: "heavy", costRMB_q1: 55, costRMB_q50: 44, costRMB_q200: 37, costRMB_q1000: 31 },
  { sku: "apparel-tote", family: "tshirt", name: "Canvas Tote Bag", process: "Screen / DTG print", weightClass: "medium", costRMB_q1: 14, costRMB_q50: 10, costRMB_q200: 8, costRMB_q1000: 6.5 },
  { sku: "pet-scarf", family: "tshirt", name: "Pet Bandana", process: "Digital print + stitching", weightClass: "light", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },

  // ── card（纸品文具） ──
  { sku: "office-notebook", family: "card", name: "Notebook A5 (Custom Cover)", process: "Digital print + perfect binding", weightClass: "medium", costRMB_q1: 9, costRMB_q50: 6.5, costRMB_q200: 5, costRMB_q1000: 4 },
  { sku: "office-stickersheet", family: "card", name: "Sticker Sheet Set (5 sheets)", process: "UV print + die-cut", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.2, costRMB_q1000: 0.8 },
  { sku: "collect-puzzle", family: "card", name: "Jigsaw Puzzle (500 pieces)", process: "Digital print + die-cut + box", weightClass: "medium", costRMB_q1: 22, costRMB_q50: 16, costRMB_q200: 13, costRMB_q1000: 10 },
  { sku: "collect-bookmark", family: "card", name: "Bookmark (Acrylic / Metal)", process: "UV print / laser engraving", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.2, costRMB_q1000: 0.8 },
  { sku: "collect-playingcards", family: "card", name: "Playing Cards (54 + gift box)", process: "Digital print + box assembly", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "collect-tradingcard", family: "card", name: "Trading Card (Holographic PET)", process: "UV print + holographic foil", weightClass: "light", costRMB_q1: 2.5, costRMB_q50: 1.5, costRMB_q200: 1, costRMB_q1000: 0.7 },
  { sku: "holiday-greeting", family: "card", name: "Greeting Card (with Envelope)", process: "Digital print + optional foil", weightClass: "light", costRMB_q1: 3.5, costRMB_q50: 2, costRMB_q200: 1.4, costRMB_q1000: 1 },
  { sku: "holiday-postcard", family: "card", name: "Postcard (Standard)", process: "Digital print", weightClass: "light", costRMB_q1: 1.5, costRMB_q50: 0.8, costRMB_q200: 0.5, costRMB_q1000: 0.35 },
  { sku: "holiday-calendar", family: "card", name: "Calendar A4 (12 pages)", process: "Digital print + binding", weightClass: "medium", costRMB_q1: 18, costRMB_q50: 13, costRMB_q200: 10, costRMB_q1000: 8 },
  { sku: "holiday-wrap", family: "card", name: "Gift Wrap Sheet", process: "Digital print", weightClass: "light", costRMB_q1: 6, costRMB_q50: 4, costRMB_q200: 3, costRMB_q1000: 2.2 },

  // ── phonecase（数码配件） ──
  { sku: "digital-phonecase", family: "phonecase", name: "Phone Case (TPU/PC)", process: "UV print", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "digital-airpods", family: "phonecase", name: "AirPods Case", process: "UV print", weightClass: "light", costRMB_q1: 8, costRMB_q50: 5.5, costRMB_q200: 4, costRMB_q1000: 3 },
  { sku: "digital-sleeve", family: "phonecase", name: "Laptop Sleeve", process: "Digital print + stitching", weightClass: "heavy", costRMB_q1: 28, costRMB_q50: 20, costRMB_q200: 16, costRMB_q1000: 13 },

  // ── sticker（贴纸与收藏小物） ──
  { sku: "collect-acrylicstand", family: "sticker", name: "Acrylic Stand 10-15cm", process: "UV print + laser cut", weightClass: "light", costRMB_q1: 8, costRMB_q50: 5.5, costRMB_q200: 4, costRMB_q1000: 3 },
  { sku: "collect-acrylickeychain", family: "sticker", name: "Acrylic Keychain (Double-Sided)", process: "UV print + laser cut", weightClass: "light", costRMB_q1: 3.5, costRMB_q50: 2.2, costRMB_q200: 1.6, costRMB_q1000: 1.2 },
  { sku: "collect-fridgemagnet", family: "sticker", name: "Fridge Magnet (Soft / Acrylic)", process: "UV print", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.3, costRMB_q1000: 0.9 },
  { sku: "wood-keychain", family: "sticker", name: "Wooden Keychain", process: "Laser engraving", weightClass: "light", costRMB_q1: 4, costRMB_q50: 2.5, costRMB_q200: 1.8, costRMB_q1000: 1.3 },
  { sku: "wood-coasters", family: "sticker", name: "Wooden Coasters (Set of 4)", process: "Laser engraving / UV print", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "wood-frame", family: "sticker", name: "Wooden Photo Frame", process: "Laser engraving + assembly", weightClass: "heavy", costRMB_q1: 18, costRMB_q50: 13, costRMB_q200: 10, costRMB_q1000: 8 },
  { sku: "metal-dogtag", family: "sticker", name: "Metal Dog Tag / Keychain", process: "Laser engraving / screen print", weightClass: "light", costRMB_q1: 5, costRMB_q50: 3.2, costRMB_q200: 2.3, costRMB_q1000: 1.7 },
  { sku: "metal-plaque", family: "sticker", name: "Metal Plaque", process: "UV print / etching", weightClass: "medium", costRMB_q1: 15, costRMB_q50: 11, costRMB_q200: 8.5, costRMB_q1000: 6.5 },
  { sku: "metal-enamelpin", family: "sticker", name: "Enamel Pin", process: "Cloisonne enamel", weightClass: "light", costRMB_q1: 6, costRMB_q50: 3.5, costRMB_q200: 2.5, costRMB_q1000: 1.8 },
  { sku: "pet-dogtag", family: "sticker", name: "Pet ID Tag", process: "UV print + laser cut", weightClass: "light", costRMB_q1: 5, costRMB_q50: 3.2, costRMB_q200: 2.3, costRMB_q1000: 1.7 },

  // ── home（家居生活，原 print3d 因附件无 3D SKU改为 home） ──
  { sku: "office-mousepad", family: "home", name: "Mouse Pad 22x18cm", process: "Heat transfer / UV print", weightClass: "medium", costRMB_q1: 7, costRMB_q50: 5, costRMB_q200: 3.8, costRMB_q1000: 3 },
  { sku: "office-deskmat", family: "home", name: "Desk Mat 80x30cm", process: "Heat transfer", weightClass: "heavy", costRMB_q1: 22, costRMB_q50: 17, costRMB_q200: 14, costRMB_q1000: 11 },
  { sku: "home-mug", family: "home", name: "Ceramic Mug 11oz", process: "Dye sublimation", weightClass: "medium", costRMB_q1: 9, costRMB_q50: 7, costRMB_q200: 5.5, costRMB_q1000: 4.8 },
  { sku: "home-tumbler", family: "home", name: "Insulated Tumbler 500ml", process: "Heat transfer film / UV", weightClass: "heavy", costRMB_q1: 28, costRMB_q50: 21, costRMB_q200: 17, costRMB_q1000: 14 },
  { sku: "home-pillow", family: "home", name: "Pillow Cover 40x40cm", process: "Dye sublimation", weightClass: "medium", costRMB_q1: 13, costRMB_q50: 9, costRMB_q200: 7, costRMB_q1000: 5.5 },
  { sku: "home-blanket", family: "home", name: "Fleece Blanket 100x150cm", process: "Dye sublimation", weightClass: "oversize", costRMB_q1: 48, costRMB_q50: 36, costRMB_q200: 29, costRMB_q1000: 23 },
  { sku: "home-glass", family: "home", name: "Drinking Glass", process: "UV print / heat transfer film", weightClass: "medium", costRMB_q1: 14, costRMB_q50: 10, costRMB_q200: 8, costRMB_q1000: 6.5 },
  { sku: "home-wineglass", family: "home", name: "Wine Glass", process: "UV print / heat transfer film", weightClass: "medium", costRMB_q1: 16, costRMB_q50: 12, costRMB_q200: 9, costRMB_q1000: 7.5 },
];

export const SKU_BY_ID: Record<string, ProductSku> = Object.fromEntries(
  PRODUCT_SKUS.map((s) => [s.sku, s]),
);

export const FAMILY_LABELS: Record<FamilyId, string> = {
  tshirt: "Apparel / Tees & Hoodies",
  poster: "Wall Art / Posters & Prints",
  card: "Paper & Stationery",
  phonecase: "Tech Accessories",
  sticker: "Stickers & Collectibles",
  home: "Home & Living",
};

// ───────────────────────── 基础换算 ─────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 单件出厂成本（美元，已除汇率） */
export function costUSD(sku: ProductSku): number {
  return round2(sku.costRMB_q1 / PRICING_CONFIG.USD_RMB);
}

/** 重量级对应国际运费（美元） */
export function freightUSD(w: WeightClass): number {
  return round2(PRICING_CONFIG.freightTiers[w].rmb / PRICING_CONFIG.USD_RMB);
}

/** 按出厂成本（不含运费）匹配加成倍数 */
export function markupFor(costUsd: number): number {
  let mult: number = PRICING_CONFIG.markupTiers[0].mult;
  for (const t of PRICING_CONFIG.markupTiers) {
    if (costUsd >= t.min) mult = t.mult;
  }
  return mult;
}

/** 目的地税率 */
export function taxRateFor(region: Region): number {
  return PRICING_CONFIG.taxRates[region] ?? PRICING_CONFIG.taxRates.DEFAULT;
}

// ───────────────────────── 核心报价（单件） ─────────────────────────

/** 建议零售价（美元，已含运费×1.15，税前） */
export function retailUSD(sku: ProductSku): number {
  const c = costUSD(sku);
  const m = markupFor(c);
  const f = freightUSD(sku.weightClass);
  return round2(c * m + f * PRICING_CONFIG.FREIGHT_PASS_THROUGH);
}

/** 系统售价（美元，含平台代缴税） */
export function salePriceUSD(sku: ProductSku, region: Region = "DEFAULT"): number {
  const r = retailUSD(sku);
  const t = r * taxRateFor(region);
  return round2(r + t);
}

/** 净价（美元）= 系统售价 − 运费分摊 − 税费分摊（分成基数） */
export function netPriceUSD(sku: ProductSku, region: Region = "DEFAULT"): number {
  const sale = salePriceUSD(sku, region);
  const f = freightUSD(sku.weightClass); // 平台实际支付的运费
  const t = retailUSD(sku) * taxRateFor(region); // 平台代缴的税
  return round2(sale - f - t);
}

/** 创作者分成（美元）= 净价 × royaltyRate，rate∈[0.10,0.50] */
export function royaltyUSD(sku: ProductSku, region: Region, rate: number): number {
  const r = Math.min(0.5, Math.max(0.1, rate));
  return round2(netPriceUSD(sku, region) * r);
}

// ───────────────────────── 多件订单运费（首件全价 + 续件递减） ─────────────────────────

export interface OrderLineInput {
  sku: string;
  qty: number;
}

/**
 * 订单总运费（美元）：每条 line 首件按重量级全价，续件 × SUBSEQUENT_FREIGHT_FACTOR 递减。
 */
export function orderFreightUSD(lines: OrderLineInput[]): number {
  let total = 0;
  for (const line of lines) {
    const sku = SKU_BY_ID[line.sku];
    if (!sku || line.qty <= 0) continue;
    const f = freightUSD(sku.weightClass);
    total += f + f * PRICING_CONFIG.SUBSEQUENT_FREIGHT_FACTOR * (line.qty - 1);
  }
  return round2(total);
}

// ───────────────────────── 便捷分（cents） ─────────────────────────

export const toCents = (usd: number): number => Math.round(usd * 100);
export const costCents = (sku: ProductSku): number => toCents(costUSD(sku));
export const retailCents = (sku: ProductSku): number => toCents(retailUSD(sku));
export const salePriceCents = (sku: ProductSku, region: Region = "DEFAULT"): number => toCents(salePriceUSD(sku, region));
export const netPriceCents = (sku: ProductSku, region: Region = "DEFAULT"): number => toCents(netPriceUSD(sku, region));
export const royaltyCents = (sku: ProductSku, region: Region, rate: number): number => toCents(royaltyUSD(sku, region, rate));

/** 单件国际运费（cents，平台实际支付的物流成本，不进分成基数） */
export const freightCents = (sku: ProductSku): number => toCents(freightUSD(sku.weightClass));

/**
 * 单件代缴税费（cents）：计入售价、由平台代缴；不进分成基数。
 * 关键性质：netPrice = salePrice − freight − tax，而 salePrice = retail×(1+tax)，
 * tax = retail×tax，故 net = retail − freight，与 region 无关。由此 creator 的净价基数
 * 在任意目的地都一致。
 */
export const taxCents = (sku: ProductSku, region: Region = "DEFAULT"): number =>
  salePriceCents(sku, region) - retailCents(sku);

/** 单件净价（cents）= 零售不含税 − 运费（= 分成基数，region 无关） */
export const netCentsForSku = (sku: ProductSku): number => retailCents(sku) - freightCents(sku);

/** 单件创作者分成（cents）= 净价 × rate，rate∈[0.10,0.50] */
export const royaltyCentsForSku = (sku: ProductSku, rate: number): number =>
  toCents(netPriceUSD(sku) * Math.min(0.5, Math.max(0.1, rate)));
