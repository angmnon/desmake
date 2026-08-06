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
    light: { rmb: 15, label: "轻 <100g" },
    medium: { rmb: 26, label: "中 100-500g" },
    heavy: { rmb: 42, label: "重 500g-2kg" },
    oversize: { rmb: 68, label: "超大 >2kg" },
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
  { sku: "wallart-poster-a4", family: "poster", name: "海报 A4 (数码印刷)", process: "UV/数码印刷-纸类", weightClass: "medium", costRMB_q1: 3.5, costRMB_q50: 2.2, costRMB_q200: 1.5, costRMB_q1000: 1 },
  { sku: "wallart-poster-a3", family: "poster", name: "海报 A3 (数码印刷)", process: "UV/数码印刷-纸类", weightClass: "medium", costRMB_q1: 5.5, costRMB_q50: 3.5, costRMB_q200: 2.4, costRMB_q1000: 1.6 },
  { sku: "wallart-poster-a2", family: "poster", name: "海报 A2 (数码印刷)", process: "UV/数码印刷-纸类", weightClass: "heavy", costRMB_q1: 9, costRMB_q50: 6, costRMB_q200: 4.2, costRMB_q1000: 3 },
  { sku: "wallart-canvas-30", family: "poster", name: "Canvas 装裱画 30x40cm", process: "喷墨+木框绷布", weightClass: "heavy", costRMB_q1: 25, costRMB_q50: 18, costRMB_q200: 14, costRMB_q1000: 11 },
  { sku: "wallart-canvas-40", family: "poster", name: "Canvas 装裱画 40x60cm", process: "喷墨+木框绷布", weightClass: "heavy", costRMB_q1: 38, costRMB_q50: 28, costRMB_q200: 22, costRMB_q1000: 17 },
  { sku: "wallart-acrylic-30", family: "poster", name: "亚克力挂画 30x40cm", process: "UV打印+亚克力板", weightClass: "heavy", costRMB_q1: 45, costRMB_q50: 34, costRMB_q200: 27, costRMB_q1000: 21 },
  { sku: "wallart-aluminum-30", family: "poster", name: "铝板金属画 30x40cm", process: "UV打印+铝复合板", weightClass: "heavy", costRMB_q1: 40, costRMB_q50: 30, costRMB_q200: 24, costRMB_q1000: 19 },

  // ── tshirt（服饰） ──
  { sku: "apparel-tee", family: "tshirt", name: "T恤 (纯棉圆领)", process: "DTG数码直喷", weightClass: "medium", costRMB_q1: 26, costRMB_q50: 20, costRMB_q200: 16, costRMB_q1000: 13 },
  { sku: "apparel-hoodie", family: "tshirt", name: "连帽卫衣 Hoodie", process: "DTG数码直喷", weightClass: "heavy", costRMB_q1: 68, costRMB_q50: 54, costRMB_q200: 45, costRMB_q1000: 38 },
  { sku: "apparel-sweatshirt", family: "tshirt", name: "卫衣 Sweatshirt", process: "DTG数码直喷", weightClass: "heavy", costRMB_q1: 55, costRMB_q50: 44, costRMB_q200: 37, costRMB_q1000: 31 },
  { sku: "apparel-tote", family: "tshirt", name: "帆布手提袋 Tote Bag", process: "丝网/DTG", weightClass: "medium", costRMB_q1: 14, costRMB_q50: 10, costRMB_q200: 8, costRMB_q1000: 6.5 },
  { sku: "pet-scarf", family: "tshirt", name: "宠物围巾/领巾", process: "数码印刷+车缝", weightClass: "light", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },

  // ── card（纸品文具） ──
  { sku: "office-notebook", family: "card", name: "笔记本 A5 定制封面", process: "数码印刷+胶装", weightClass: "medium", costRMB_q1: 9, costRMB_q50: 6.5, costRMB_q200: 5, costRMB_q1000: 4 },
  { sku: "office-stickersheet", family: "card", name: "不干胶贴纸套装 (5张/套)", process: "UV打印+模切", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.2, costRMB_q1000: 0.8 },
  { sku: "collect-puzzle", family: "card", name: "拼图 Jigsaw 500片", process: "数码印刷+模切+纸盒", weightClass: "medium", costRMB_q1: 22, costRMB_q50: 16, costRMB_q200: 13, costRMB_q1000: 10 },
  { sku: "collect-bookmark", family: "card", name: "书签 (亚克力/金属)", process: "UV打印/激光雕刻", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.2, costRMB_q1000: 0.8 },
  { sku: "collect-playingcards", family: "card", name: "定制扑克牌 54张+礼盒", process: "数码印刷+糊盒", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "collect-tradingcard", family: "card", name: "收藏卡/闪卡 PET镭射", process: "UV打印+镭射烫金", weightClass: "light", costRMB_q1: 2.5, costRMB_q50: 1.5, costRMB_q200: 1, costRMB_q1000: 0.7 },
  { sku: "holiday-greeting", family: "card", name: "贺卡 (含信封)", process: "数码印刷+烫金(可选)", weightClass: "light", costRMB_q1: 3.5, costRMB_q50: 2, costRMB_q200: 1.4, costRMB_q1000: 1 },
  { sku: "holiday-postcard", family: "card", name: "明信片 标准款", process: "数码印刷", weightClass: "light", costRMB_q1: 1.5, costRMB_q50: 0.8, costRMB_q200: 0.5, costRMB_q1000: 0.35 },
  { sku: "holiday-calendar", family: "card", name: "台历/挂历 A4 12页", process: "数码印刷+装订", weightClass: "medium", costRMB_q1: 18, costRMB_q50: 13, costRMB_q200: 10, costRMB_q1000: 8 },
  { sku: "holiday-wrap", family: "card", name: "礼品包装纸 (单张)", process: "数码印刷", weightClass: "light", costRMB_q1: 6, costRMB_q50: 4, costRMB_q200: 3, costRMB_q1000: 2.2 },

  // ── phonecase（数码配件） ──
  { sku: "digital-phonecase", family: "phonecase", name: "手机壳 (TPU/PC)", process: "UV打印", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "digital-airpods", family: "phonecase", name: "AirPods 保护壳", process: "UV打印", weightClass: "light", costRMB_q1: 8, costRMB_q50: 5.5, costRMB_q200: 4, costRMB_q1000: 3 },
  { sku: "digital-sleeve", family: "phonecase", name: "笔记本电脑内胆包", process: "数码印刷+车缝", weightClass: "heavy", costRMB_q1: 28, costRMB_q50: 20, costRMB_q200: 16, costRMB_q1000: 13 },

  // ── sticker（贴纸与收藏小物） ──
  { sku: "collect-acrylicstand", family: "sticker", name: "亚克力立牌 10-15cm", process: "UV打印+激光切割", weightClass: "light", costRMB_q1: 8, costRMB_q50: 5.5, costRMB_q200: 4, costRMB_q1000: 3 },
  { sku: "collect-acrylickeychain", family: "sticker", name: "亚克力钥匙扣 双面印刷", process: "UV打印+激光切割", weightClass: "light", costRMB_q1: 3.5, costRMB_q50: 2.2, costRMB_q200: 1.6, costRMB_q1000: 1.2 },
  { sku: "collect-fridgemagnet", family: "sticker", name: "冰箱贴 (软磁/亚克力)", process: "UV打印", weightClass: "light", costRMB_q1: 3, costRMB_q50: 1.8, costRMB_q200: 1.3, costRMB_q1000: 0.9 },
  { sku: "wood-keychain", family: "sticker", name: "木质钥匙扣", process: "激光雕刻", weightClass: "light", costRMB_q1: 4, costRMB_q50: 2.5, costRMB_q200: 1.8, costRMB_q1000: 1.3 },
  { sku: "wood-coasters", family: "sticker", name: "木质杯垫 4件套", process: "激光雕刻/UV打印", weightClass: "medium", costRMB_q1: 12, costRMB_q50: 8, costRMB_q200: 6, costRMB_q1000: 4.5 },
  { sku: "wood-frame", family: "sticker", name: "木质相框", process: "激光雕刻+组装", weightClass: "heavy", costRMB_q1: 18, costRMB_q50: 13, costRMB_q200: 10, costRMB_q1000: 8 },
  { sku: "metal-dogtag", family: "sticker", name: "金属狗牌/钥匙扣", process: "激光雕刻/丝印", weightClass: "light", costRMB_q1: 5, costRMB_q50: 3.2, costRMB_q200: 2.3, costRMB_q1000: 1.7 },
  { sku: "metal-plaque", family: "sticker", name: "金属铭牌/纪念牌", process: "UV打印/蚀刻", weightClass: "medium", costRMB_q1: 15, costRMB_q50: 11, costRMB_q200: 8.5, costRMB_q1000: 6.5 },
  { sku: "metal-enamelpin", family: "sticker", name: "珐琅徽章/胸针", process: "景泰蓝珐琅工艺", weightClass: "light", costRMB_q1: 6, costRMB_q50: 3.5, costRMB_q200: 2.5, costRMB_q1000: 1.8 },
  { sku: "pet-dogtag", family: "sticker", name: "宠物冰箱贴款狗牌", process: "UV打印+激光切割", weightClass: "light", costRMB_q1: 5, costRMB_q50: 3.2, costRMB_q200: 2.3, costRMB_q1000: 1.7 },

  // ── home（家居生活，原 print3d 因附件无 3D SKU改为 home） ──
  { sku: "office-mousepad", family: "home", name: "鼠标垫 标准 22x18cm", process: "热转印/UV打印", weightClass: "medium", costRMB_q1: 7, costRMB_q50: 5, costRMB_q200: 3.8, costRMB_q1000: 3 },
  { sku: "office-deskmat", family: "home", name: "加长桌垫 Desk Mat 80x30cm", process: "热转印", weightClass: "heavy", costRMB_q1: 22, costRMB_q50: 17, costRMB_q200: 14, costRMB_q1000: 11 },
  { sku: "home-mug", family: "home", name: "马克杯 11oz 陶瓷", process: "热升华印刷", weightClass: "medium", costRMB_q1: 9, costRMB_q50: 7, costRMB_q200: 5.5, costRMB_q1000: 4.8 },
  { sku: "home-tumbler", family: "home", name: "保温杯/随行杯 500ml", process: "热转印膜/UV", weightClass: "heavy", costRMB_q1: 28, costRMB_q50: 21, costRMB_q200: 17, costRMB_q1000: 14 },
  { sku: "home-pillow", family: "home", name: "抱枕套 40x40cm", process: "热升华印刷", weightClass: "medium", costRMB_q1: 13, costRMB_q50: 9, costRMB_q200: 7, costRMB_q1000: 5.5 },
  { sku: "home-blanket", family: "home", name: "毛毯 法兰绒 100x150cm", process: "热升华印刷", weightClass: "oversize", costRMB_q1: 48, costRMB_q50: 36, costRMB_q200: 29, costRMB_q1000: 23 },
  { sku: "home-glass", family: "home", name: "玻璃杯 (热转印膜)", process: "UV打印/热转印膜", weightClass: "medium", costRMB_q1: 14, costRMB_q50: 10, costRMB_q200: 8, costRMB_q1000: 6.5 },
  { sku: "home-wineglass", family: "home", name: "红酒杯 (热转印膜)", process: "UV打印/热转印膜", weightClass: "medium", costRMB_q1: 16, costRMB_q50: 12, costRMB_q200: 9, costRMB_q1000: 7.5 },
];

export const SKU_BY_ID: Record<string, ProductSku> = Object.fromEntries(
  PRODUCT_SKUS.map((s) => [s.sku, s]),
);

export const FAMILY_LABELS: Record<FamilyId, string> = {
  tshirt: "服饰 / T恤卫衣",
  poster: "墙面艺术 / 海报装裱画",
  card: "纸品文具 / 卡片",
  phonecase: "数码配件",
  sticker: "贴纸与收藏小物",
  home: "家居生活",
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
