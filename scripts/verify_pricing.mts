// 校验 pricing.ts 引擎：用附件已知的"建议零售价"反向验证公式正确性
import {
  SKU_BY_ID, retailUSD, salePriceUSD, netPriceUSD, royaltyUSD,
  orderFreightUSD, freightUSD, PRICING_CONFIG,
} from "../src/lib/pricing.ts";

let pass = 0, fail = 0;
function approx(name: string, got: number, expect: number, tol = 0.02) {
  const ok = Math.abs(got - expect) <= tol;
  console.log(`${ok ? "✅" : "❌"} ${name}: got=${got.toFixed(4)} expect≈${expect.toFixed(4)}`);
  ok ? pass++ : fail++;
}

// 附件建议零售价（税前，美元）对照
approx("T恤 零售价", retailUSD(SKU_BY_ID["apparel-tee"]), 15.71);
approx("明信片 零售价", retailUSD(SKU_BY_ID["holiday-postcard"]), 3.54);
approx("马克杯 零售价", retailUSD(SKU_BY_ID["home-mug"]), 9.40);
approx("连帽卫衣 零售价", retailUSD(SKU_BY_ID["apparel-hoodie"]), 31.26);
approx("海报A4 零售价", retailUSD(SKU_BY_ID["wallart-poster-a4"]), 6.83);
approx("收藏卡 零售价", retailUSD(SKU_BY_ID["collect-tradingcard"]), 4.31);
approx("亚克力挂画 零售价", retailUSD(SKU_BY_ID["wallart-acrylic-30"]), 26.71);
approx("毛毯 零售价", retailUSD(SKU_BY_ID["home-blanket"]), 32.19);

// 税费（平台代缴，计入售价）
const teeEU = salePriceUSD(SKU_BY_ID["apparel-tee"], "EU");
approx("T恤 EU售价(含19%税)", teeEU, 15.71 * 1.19);

// 净价 = 售价 − 运费 − 税；royalty = 净价 × rate
const teeNetUS = netPriceUSD(SKU_BY_ID["apparel-tee"], "US");
// 手动算：retail=15.7083, freight(medium)=3.6111, tax=retail*0.07=1.0996
// net = 15.7083+1.0996 - 3.6111 - 1.0996 = 12.0972
approx("T恤 US净价", teeNetUS, 12.10);
approx("T恤 US 30%分成", royaltyUSD(SKU_BY_ID["apparel-tee"], "US", 0.30), teeNetUS * 0.30);

// 多件运费：首件全价 + 续件递减（系数0.35）
// 2件T恤(medium, freight=3.6111): 3.6111 + 3.6111*0.35 = 4.8749
const of = orderFreightUSD([{ sku: "apparel-tee", qty: 2 }]);
approx("2件T恤运费(首全+续0.35)", of, freightUSD("medium") * (1 + 0.35));

// 跨类目合计运费：T恤×1 + 马克杯(medium)×3
const of2 = orderFreightUSD([
  { sku: "apparel-tee", qty: 1 },
  { sku: "home-mug", qty: 3 },
]);
const exp2 = freightUSD("medium") * (1 + 0.35 * 0) + freightUSD("medium") * (1 + 0.35 * 2);
approx("T恤×1+马克杯×3 运费", of2, exp2);

console.log(`\nSKU 总数: ${Object.keys(SKU_BY_ID).length}，税率表: EU=${PRICING_CONFIG.taxRates.EU} US=${PRICING_CONFIG.taxRates.US}`);
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
