// ============================================================
// Desmake — 首页精品图源（Homepage Curated Real-Image Pool）
// ============================================================
//
// 背景：首页原本只消费种子 `DESIGNS`，而种子数据**没有任何 imageUrl** ——
// 首页所有图（Hero 3 张 / Discover 网格 / Featured / 6 个适配器示例图）
// 都由 `Artwork` 用 seed+palette 现场生成 SVG 抽象占位图。
// 我们批量上传到 R2 的精品商品图（两个内部运营账号，共约 7.4k 张）
// 一张都没上首页。
//
// 本模块从 D1 设计索引里筛出「真实上传图」池，按内容完整度 + 新近度打分，
// 再用类目多样性约束挑选首页各展示位，让首页真正展示我们的商品图。
//
// 设计原则：
//  1. 只认真实图：没有 imageUrl 的设计一律不进池（从根上杜绝占位图上首页）。
//  2. 只认内部运营账号：外部 UGC / QA 测试数据不上首页。
//  3. 打分信号适配 published 数据：published 设计的 likes/views/sales/rating
//     全是 0（无埋点），既有 recommend.ts 的多信号打分会退化，所以这里改用
//     「内容完整度（文案/标签/可售 SKU）+ 新近度」作为精品代理信号。
//  4. 确定性：打分带微小 hash tie-break，保证 ISR 每次重生成结果一致。
//  5. 永不 blank：D1 不可用或池为空时降级回种子 SVG 占位图（`real: false`）。

import { getDesignIndex } from "@/lib/catalogIndex";
// `PublishedDesign` 定义在 stores；catalogIndex 只是自己 import 它，并未 re-export。
import type { PublishedDesign } from "@/lib/stores";
import { publishedToDesign } from "@/lib/catalog";
import { DESIGNS, type Design } from "@/lib/data";
import { select, recommendHomepage, type Scored } from "@/lib/recommend";

/**
 * "我们上传的"：Desmake 内部批量运营账号。
 *  - catalog@desmake.local（Desmake Catalog）
 *  - desmake.bulk.uploader@desmake.local（Desmake Bulk Uploader）
 * 其余 user 为真实外部创作者，其作品留给 /explore 与创作者页，不上首页。
 */
export const INTERNAL_UPLOADERS: ReadonlySet<string> = new Set([
  "usr_0msddwy564f4584711b9ee795",
  "usr_0msn19mgqc8efe006cd3a97f2",
]);

/** QA / 测试产物标题 —— 绝不上首页（批量上传时遗留的验证数据）。 */
const QA_TITLE_RE = /\b(qa|test|dummy|sample|placeholder|debug)\b/i;

/** 是否可上首页：真实图 + 内部账号 + 非测试产物。 */
export function isCuratable(p: PublishedDesign): boolean {
  if (!p.imageUrl) return false;
  if (!INTERNAL_UPLOADERS.has(p.user_id)) return false;
  if (QA_TITLE_RE.test(p.title || "")) return false;
  return true;
}

/** 内容完整度 0–1：创作者填得越完整，越可能是精心制作的精品。 */
function completeness(d: Design): number {
  const desc = Math.min(1, (d.description?.trim().length ?? 0) / 180);
  const tags = Math.min(1, (d.tags?.length ?? 0) / 4);
  const skus = Math.min(1, (d.selectedProducts?.length ?? 0) / 3);
  return desc * 0.55 + tags * 0.2 + skus * 0.25;
}

/** 发布时间（ms）。无法解析时取 0（排最后）。 */
function createdMs(d: Design): number {
  const t = Date.parse(d.created || "");
  return Number.isFinite(t) ? t : 0;
}

/** 确定性微小扰动（≤1e-6），仅用于分数相同（如全 0 信号）时稳定排序。 */
function tieBreak(slug: string): number {
  let h = 5381;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) + h + slug.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000000) * 1e-12;
}

/** min-max 归一化；全相等时返回常数 0.5。 */
function makeNorm(values: number[]): (x: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return (x: number) => (span <= 1e-9 ? 0.5 : (x - min) / span);
}

export type CurationWeights = {
  /** 内容完整度权重（文案/标签/SKU）。 */
  complete: number;
  /** 新近度权重（发布时间）。 */
  recent: number;
};

/** 主榜单：完整度优先，新近度兜底 —— "精品"而非"最新"。 */
export const CURATED_WEIGHTS: CurationWeights = { complete: 0.62, recent: 0.38 };
/** "上新"榜单：新近度主导。 */
export const FRESH_WEIGHTS: CurationWeights = { complete: 0.2, recent: 0.8 };

/** 对精品池打分（分数 0–1，仅用于同一次调用内的相对比较）。 */
export function scoreCurated(designs: Design[], weights: CurationWeights = CURATED_WEIGHTS): Scored[] {
  if (designs.length === 0) return [];
  const compNorm = makeNorm(designs.map(completeness));
  const timeNorm = makeNorm(designs.map(createdMs));
  return designs.map((d) => {
    const score =
      compNorm(completeness(d)) * weights.complete + timeNorm(createdMs(d)) * weights.recent;
    return { design: d, score: score + tieBreak(d.slug) };
  });
}

export type HomeCurated = {
  trending: Design[];
  newDesigns: Design[];
  aiPicks: Design[];
  editors: Design[];
  heroCards: Design[];
  featured: Design;
  /** 6 个制造适配器区块的示例图（每个适配器一张）。 */
  adapterSamples: Design[];
  /** true = 真实上传图；false = 已降级为种子 SVG 占位图。 */
  real: boolean;
};

/** D1 不可用 / 池为空时的降级：沿用原有种子推荐（SVG 占位图）。 */
function seedFallback(): HomeCurated {
  return { ...recommendHomepage(DESIGNS), adapterSamples: [], real: false };
}

/**
 * 计算首页全部展示位 —— 全部来自我们真实上传的精品商品图。
 *
 * 各榜单的类目多样性上限刻意压低（maxPerGroup=2）：内部池里 `art` 类占了
 * 约 68%，不加约束会让整屏都是同一种风格。
 */
export async function curatedHomepage(): Promise<HomeCurated> {
  let pool: Design[];
  try {
    const idx = await getDesignIndex();
    pool = idx.all.filter(isCuratable).map(publishedToDesign);
  } catch {
    // D1 / 索引异常时绝不 blank 首页。
    return seedFallback();
  }
  if (pool.length === 0) return seedFallback();

  const scored = scoreCurated(pool, CURATED_WEIGHTS);
  const freshScored = scoreCurated(pool, FRESH_WEIGHTS);
  const aiScored = scoreCurated(
    pool.filter((d) => d.aiGenerated),
    CURATED_WEIGHTS,
  );

  // 主榜单：完整度优先，同类目最多 2 个。
  const trending = select(scored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 2 });

  // 编辑精选：高质量但避开主榜单，保证两个 tab 不重复。
  const editors = select(scored, {
    take: 8,
    groupBy: (d) => d.category,
    maxPerGroup: 2,
    exclude: new Set(trending.map((d) => d.id)),
  });

  // AI 作品（内部账号的 AI 生成图）。
  const aiPicks = select(aiScored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 2 });

  // 上新：按发布时间排序。
  const newDesigns = select(freshScored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 2 });

  // Hero 3 张：强制 3 个不同类目（真图场景下 palette 多为默认值，改用类目做多样性）。
  const heroCards = select(scored, { take: 3, groupBy: (d) => d.category, maxPerGroup: 1 });

  // Featured 主图：避开 Hero，避免首屏两张大图重复。
  const usedIds = new Set(heroCards.map((d) => d.id));
  const featuredScored = scored.filter((s) => !usedIds.has(s.design.id));
  const featured = (featuredScored[0] ?? scored[0])?.design ?? pool[0];

  // 6 个适配器示例图：再避开 Featured 与 Discover 主榜单，
  // 让首页一屏内 18 个图位尽量是 18 张互不相同的精品图。
  usedIds.add(featured.id);
  for (const d of trending) usedIds.add(d.id);
  const adapterSamples = select(scored, {
    take: 6,
    groupBy: (d) => d.category,
    maxPerGroup: 2,
    exclude: usedIds,
  });

  return { trending, newDesigns, aiPicks, editors, heroCards, featured, adapterSamples, real: true };
}
