/**
 * M3–M6 自检：验证「净价 = 零售 − 运费」「税费计入售价」「分成 = 净价 × rate」
 * 以及多件运费递减在订单合计中的表现。
 * 运行： npx tsx scripts/verify_royalty.ts
 */
import {
  SKU_BY_ID,
  retailCents,
  salePriceCents,
  freightCents,
  taxCents,
  netCentsForSku,
  royaltyCentsForSku,
  costCents,
  type Region,
} from "../src/lib/pricing";
import { computeOrderTotals, regionFromCountry } from "../src/lib/data";

const money = (c: number) => "$" + (c / 100).toFixed(2);
let fail = 0;
function check(label: string, cond: boolean, detail: string) {
  if (!cond) { fail++; console.log("  ✗ " + label + " — " + detail); }
  else console.log("  ✓ " + label + " — " + detail);
}

console.log("\n=== 1. 单 SKU 分解（tee / poster / phonecase）===");
for (const id of ["apparel-tee", "wallart-poster-a3", "digital-phonecase", "home-mug"]) {
  const s = SKU_BY_ID[id];
  if (!s) { console.log("  ! missing sku " + id); fail++; continue; }
  const cost = costCents(s), retail = retailCents(s), fr = freightCents(s);
  const net = netCentsForSku(s);
  console.log(`\n[${id}] ${s.name}  weight=${s.weightClass}`);
  console.log(`  cost=${money(cost)}  freight=${money(fr)}  retail=${money(retail)}  net=${money(net)}`);
  check("净价 = 零售 − 运费", net === retail - fr, `${money(net)} == ${money(retail)} - ${money(fr)}`);

  for (const region of ["US", "EU", "DEFAULT"] as Region[]) {
    const sale = salePriceCents(s, region);
    const tax = taxCents(s, region);
    check(
      `[${region}] 售价 = 零售 + 税`,
      Math.abs(sale - (retail + tax)) <= 1,
      `sale=${money(sale)} retail=${money(retail)} tax=${money(tax)}`
    );
    // 净价与 region 无关 → 分成基数稳定
    check(`[${region}] 净价与地区无关`, netCentsForSku(s) === net, `net=${money(net)}`);
  }

  for (const rate of [0.1, 0.3, 0.5]) {
    const r = royaltyCentsForSku(s, rate);
    check(
      `分成 ${(rate * 100).toFixed(0)}%`,
      Math.abs(r - Math.round(net * rate)) <= 1,
      `royalty=${money(r)} (net ${money(net)} × ${rate})`
    );
  }
  // clamp
  check("rate 越界被夹到 [10%,50%]", royaltyCentsForSku(s, 0.9) === royaltyCentsForSku(s, 0.5), "0.9 → 0.5");
  check("rate 过低被夹到 10%", royaltyCentsForSku(s, 0.01) === royaltyCentsForSku(s, 0.1), "0.01 → 0.1");
}

console.log("\n=== 2. 订单合计（多件运费递减 + 分区计税）===");
const lines = [{ sku: "apparel-tee", qty: 3 }, { sku: "wallart-poster-a3", qty: 2 }];
for (const country of ["US", "DE", "JP"]) {
  const region = regionFromCountry(country);
  const t = computeOrderTotals(lines, region);
  console.log(
    `  ${country} → ${region}: subtotal=${money(t.subtotalCents)} shipping=${money(t.shippingCents)} tax=${money(t.taxCents)} total=${money(t.totalCents)}`
  );
  check(`[${country}] total = subtotal + shipping`, t.totalCents === t.subtotalCents + t.shippingCents, "");
  check(`[${country}] 税 >= 0`, t.taxCents >= 0, `${money(t.taxCents)}`);
}
const one = computeOrderTotals([{ sku: "apparel-tee", qty: 1 }], "US");
const five = computeOrderTotals([{ sku: "apparel-tee", qty: 5 }], "US");
check(
  "5 件运费 < 5 × 单件运费（续件递减生效）",
  five.shippingCents < one.shippingCents * 5,
  `1件=${money(one.shippingCents)} 5件=${money(five.shippingCents)} (5×单件=${money(one.shippingCents * 5)})`
);
check("US 无 EU 税率", computeOrderTotals(lines, "US").taxCents < computeOrderTotals(lines, "EU").taxCents, "US tax < EU tax");
check("DEFAULT 区零税", computeOrderTotals(lines, "DEFAULT").taxCents === 0, "tax=0");

console.log(fail === 0 ? "\n✅ ALL CHECKS PASSED\n" : `\n❌ ${fail} CHECK(S) FAILED\n`);
process.exit(fail === 0 ? 0 : 1);
