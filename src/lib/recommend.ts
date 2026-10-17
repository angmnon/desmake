// ============================================================
// Desmake — 首页推荐引擎（Homepage Recommendation Engine）
// ============================================================
//
// 把首页原本的 `DESIGNS.slice(0, N)` / `sort((a,b)=>b.likes-a.likes)` 朴素切片，
// 升级为基于多信号的加权打分 + 类目多样性约束的推荐算法。
//
// 设计目标：
//  1. 多信号融合：热度(互动)、转化(销量)、质量(评分×评论置信度)、新鲜度、AI 标记。
//  2. 长尾压缩：likes/views/sales 用对数归一，避免爆款把所有指标拉爆。
//  3. 类目多样性：每个榜单内部限制同类目占比，避免整屏都是同一个风格。
//  4. 纯函数 + 确定性：仅依赖数据，无随机数 → SSR/CSR 一致、可缓存。
//  5. 可扩展：目前是"匿名访客"的全局热门/质量排序；登录态个性化（基于浏览/购买
//     历史的类目偏好）可在 `scoreDesigns` 之外叠加一层 rerank，本文件已预留权重参数。
//
// 注意：本引擎对 `Design[]` 通用，首页当前喂入种子 `DESIGNS`；若日后首页改用
// `findListingByIdAsync` 拉取真实已发布设计，同一套函数直接复用。

import type { Design } from "@/lib/data";

/** 各信号的权重（权重之和不必为 1，内部会按加权求和，绝对量级不影响排序）。 */
export type ScoreWeights = {
  /** 热度：likes + views 的互动量（长尾压缩后的归一值）。 */
  heat: number;
  /** 转化：销量（最强的购买意图信号）。 */
  sales: number;
  /** 质量：评分经评论数加权的贝叶斯估计（评论越多越可信）。 */
  quality: number;
  /** 新鲜度：isNew 的二值加成。 */
  recency: number;
  /** AI 标记：aiGenerated 的二值加成（首页对 AI 作品的轻度倾斜）。 */
  ai: number;
};

/** 默认权重：热门榜单用——热度与质量并重，销量次之。 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  heat: 0.34,
  sales: 0.22,
  quality: 0.26,
  recency: 0.12,
  ai: 0.06,
};

/** "上新"榜单权重：新鲜度主导，质量兜底，弱化历史热度。 */
export const NEW_WEIGHTS: ScoreWeights = {
  heat: 0.15,
  sales: 0.1,
  quality: 0.25,
  recency: 0.45,
  ai: 0.05,
};

// 贝叶斯先验：把评分往"全局基线"拉，评论数少的设计不至于仅凭 5.0 虚高。
const QUALITY_PRIOR_MEAN = 4.5;
const QUALITY_PRIOR_COUNT = 10;

/**
 * 生成归一化函数。log=true 时先做 log1p 压缩长尾，再做 min-max 归一。
 * 当所有输入相等（span≈0）时返回常数 0.5，避免除零。
 */
function makeNorm(values: number[], opts: { log?: boolean } = {}): (x: number) => number {
  const fn = opts.log ? (v: number) => Math.log1p(Math.max(0, v)) : (v: number) => v;
  const xs = values.map(fn);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = max - min;
  return (x: number) => {
    if (span <= 1e-9) return 0.5;
    return (fn(x) - min) / span;
  };
}

/** 评论数加权的贝叶斯评分（0–5，评论越多越接近真实 rating）。 */
function bayesianRating(d: Design): number {
  const reviews = Math.max(0, d.reviews);
  return (d.rating * reviews + QUALITY_PRIOR_MEAN * QUALITY_PRIOR_COUNT) / (reviews + QUALITY_PRIOR_COUNT);
}

export type Scored = { design: Design; score: number };

/**
 * 对一组设计做加权打分，返回 `{ design, score }[]`（分数在 0–1 之间，越高越优，
 * 但绝对值只用于同一次调用内的相对比较）。
 */
export function scoreDesigns(designs: Design[], weights: ScoreWeights = DEFAULT_WEIGHTS): Scored[] {
  if (designs.length === 0) return [];

  const heatNorm = makeNorm(designs.map((d) => d.likes + Math.round(d.views * 0.05)), { log: true });
  const salesNorm = makeNorm(designs.map((d) => d.sales), { log: true });
  const qualityNorm = makeNorm(designs.map((d) => bayesianRating(d)));

  return designs.map((d) => {
    const heat = heatNorm(d.likes + Math.round(d.views * 0.05));
    const sales = salesNorm(d.sales);
    const quality = qualityNorm(bayesianRating(d));
    const recency = d.isNew ? 1 : 0;
    const ai = d.aiGenerated ? 1 : 0;
    const score =
      heat * weights.heat +
      sales * weights.sales +
      quality * weights.quality +
      recency * weights.recency +
      ai * weights.ai;
    return { design: d, score };
  });
}

type SelectOpts = {
  take: number;
  /** 多样性分组键；同一组的入选数量受 `maxPerGroup` 限制。缺省按 id（即不约束）。 */
  groupBy?: (d: Design) => string;
  maxPerGroup?: number;
  /** 排除的设计 id 集合（用于让不同榜单错位、不重复）。 */
  exclude?: Set<string>;
};

/**
 * 从已打分列表中贪心选出 top-N。先按分数降序、在 `maxPerGroup` 约束下挑选；
 * 若约束导致名额没填满，第二轮放宽约束补齐，保证永远返回恰好 `take` 个（或全集）。
 */
export function select(scored: Scored[], opts: SelectOpts): Design[] {
  const groupBy = opts.groupBy;
  const maxPer = opts.maxPerGroup ?? Infinity;
  const exclude = opts.exclude ?? new Set<string>();
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const counts = new Map<string, number>();
  const takenIds = new Set<string>();
  const out: Design[] = [];

  const consider = (relax: boolean) => {
    for (const s of sorted) {
      if (out.length >= opts.take) return;
      if (exclude.has(s.design.id) || takenIds.has(s.design.id)) continue;
      const key = groupBy ? groupBy(s.design) : s.design.id;
      const used = counts.get(key) ?? 0;
      if (!relax && used >= maxPer) continue;
      counts.set(key, used + 1);
      takenIds.add(s.design.id);
      out.push(s.design);
    }
  };

  consider(false);
  if (out.length < opts.take) consider(true);
  return out;
}

export type HomeRecommendation = {
  trending: Design[];
  newDesigns: Design[];
  aiPicks: Design[];
  editors: Design[];
  heroCards: Design[];
  featured: Design;
};

/**
 * 计算首页全部展示位的产品集合。
 *
 *  - trending：综合打分最高的 8 个，类目多样性 maxPerGroup=3（"为你推荐/热门"主榜单）。
 *  - newDesigns：以上新权重排序的 8 个（新鲜度主导）。
 *  - aiPicks：AI 生成作品中综合打分最高的 8 个。
 *  - editors：综合打分高、且未进入 trending 的 8 个（编辑精选，更强调质量与口碑）。
 *  - heroCards：综合打分最高的 3 个，强制不同 palette（视觉上更丰富）。
 *  - featured：综合打分最高的单品（首屏 Featured collection 主图）。
 */
export function recommendHomepage(designs: Design[]): HomeRecommendation {
  const scored = scoreDesigns(designs, DEFAULT_WEIGHTS);
  const newScored = scoreDesigns(designs, NEW_WEIGHTS);
  const aiScored = scoreDesigns(
    designs.filter((d) => d.aiGenerated),
    DEFAULT_WEIGHTS,
  );

  const trending = select(scored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 3 });

  const editors = select(scored, {
    take: 8,
    groupBy: (d) => d.category,
    maxPerGroup: 2,
    exclude: new Set(trending.map((d) => d.id)),
  });

  const aiPicks = select(aiScored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 3 });

  const newDesigns = select(newScored, { take: 8, groupBy: (d) => d.category, maxPerGroup: 3 });

  // 英雄卡：强制不同 palette（每个调色板最多 1 张），视觉上更丰富。
  const heroCards = select(scored, { take: 3, groupBy: (d) => d.palette.join("|"), maxPerGroup: 1 });

  const top = [...scored].sort((a, b) => b.score - a.score)[0];
  const featured = top ? top.design : designs[0];

  return { trending, newDesigns, aiPicks, editors, heroCards, featured };
}
