// M2 校验：确认 6 大类 adapter 的基准价已由 pricing.ts 引擎计算，且与附件一致。
import {
  SKU_BY_ID, type FamilyId, costCents as skuCostCents, retailCents as skuRetailCents,
  netPriceCents, royaltyCents,
} from "../src/lib/pricing.ts";

// 与 data.ts 中 FAMILY_DEFAULT_SKU 保持一致
const FAMILY_DEFAULT_SKU: Record<FamilyId, string> = {
  tshirt: "apparel-tee",
  poster: "wallart-poster-a4",
  card: "office-notebook",
  phonecase: "digital-phonecase",
  sticker: "office-stickersheet",
  home: "home-mug",
};

const usd = (c: number) => "$" + (c / 100).toFixed(2);

console.log("=== 6 大类基准价（来自真实供应链成本）===");
const expected: Record<string, [number, number]> = {
  // family: [期望 retail 下限, 上限]（cents），用于软校验
  tshirt: [1500, 1700],   // apparel-tee ≈ $15.70
  poster: [600, 800],     // wallart-poster-a4 ≈ $6.82
  card: [900, 1000],      // office-notebook ≈ $9.40
  phonecase: [1050, 1200],// digital-phonecase ≈ $11.15
  sticker: [400, 550],    // office-stickersheet ≈ $4.69
  home: [900, 1000],      // home-mug ≈ $9.40
};

let ok = 0, fail = 0;
for (const f of Object.keys(FAMILY_DEFAULT_SKU) as FamilyId[]) {
  const sku = SKU_BY_ID[FAMILY_DEFAULT_SKU[f]];
  const cost = skuCostCents(sku);
  const retail = skuRetailCents(sku);
  const [lo, hi] = expected[f];
  const pass = retail >= lo && retail <= hi;
  if (pass) ok++; else fail++;
  console.log(
    `  ${f.padEnd(10)} sku=${sku.sku.padEnd(22)} cost=${usd(cost).padEnd(8)} retail=${usd(retail).padEnd(8)} ${pass ? "✓" : "✗ 期望 " + usd(lo) + "~" + usd(hi)}`,
  );
}

console.log("\n=== 分成模型校验（royalty = 净价 × rate）===");
// 以 tshirt 为例，rate=30%
const sku = SKU_BY_ID[FAMILY_DEFAULT_SKU.tshirt];
const net = netPriceCents(sku, "DEFAULT");
const roy30 = royaltyCents(sku, "DEFAULT", 0.3);
const roy10 = royaltyCents(sku, "DEFAULT", 0.1);
const roy50 = royaltyCents(sku, "DEFAULT", 0.5);
console.log(`  tshirt retail=${usd(skuRetailCents(sku))} net=${usd(net)}`);
console.log(`  royalty @10%=${usd(roy10)} @30%=${usd(roy30)} @50%=${usd(roy50)}`);
const royOk = roy10 <= roy30 && roy30 <= roy50 && Math.abs(roy30 - Math.round(net * 0.3)) <= 2;
if (royOk) ok++; else fail++;
console.log(`  分成随 rate 单调递增且在 [10%,50%] 区间： ${royOk ? "✓" : "✗"}`);

console.log(`\n结果: ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
