# 分享卡片方案（Share Card Plan）— 让分享出去的链接卡片更吸引人、驱动定制购买

> 目标：让 Desmake 商品页被分享到 Twitter / Facebook / LinkedIn / WhatsApp / Telegram / iMessage / Discord 时，
> 预览卡片不再是「一张裸产品图」，而是**带品牌、价格、CTA、创作者信息的定制购买钩子**；
> 点击卡片 → 进入已预选 SKU 的商品页（上一轮已落地）→ 一键 Buy now。

---

## 1. 现状盘点（已核实）

| 项 | 现状 |
|---|---|
| OG / Twitter 图片来源 | `listing/[slug]/layout.tsx` 的 `ogImageFor()` 只返回**原始产品图**（`/cdn/...`）或通用静态 `/og.png` |
| 卡片内容 | 无品牌、无价格、无 CTA、无创作者、无评分 —— 只是裸图 |
| `generateMetadata` | 标题/描述/canonical/OG+Twitter 结构已完整，仅 `og:image`/`twitter:image` 指向裸图 |
| `next/og`（`ImageResponse`） | 全站**未使用**。已确认在 OpenNext + Cloudflare Workers 上「开箱即用」可跑 |
| 可用绑定 | `wrangler.jsonc` 已声明：`IMAGES`（PNG→JPEG 转码）、`BUCKET`（R2 持久缓存）、`DB`（D1 查商品）、`nodejs_compat` |
| 中间件 | **无** → 不存在 `set-cookie` 破坏边缘缓存的风险 |
| 已落地能力 | 上一轮：分享带 `/api/ref?ref=&to=/listing/slug?sku=&variant=` 深链 + Buy now 按钮（已部署、已验证） |

**结论**：技术上完全可行，且关键绑定（IMAGES / R2 / D1）都已就绪，无需新增 Cloudflare 资源。

---

## 2. 方案总览

新增一个动态 OG 路由，用 `next/og`（`ImageResponse` / Satori）**合成一张品牌卡片**，再经 `IMAGES` 绑定把 PNG 转成 JPEG 缩小体积，最后让 `og:image`/`twitter:image` 指向它。

```
分享 URL（含深链）
   │ 社交爬虫抓取 listing HTML
   ▼
generateMetadata → og:image = https://desmake.com/og/listing/<slug>
   │
   ▼
GET /og/listing/<slug>  (Workers 上的 route)
   ├─ 取商品数据（复用 D1 resolveDesign）
   ├─ 取产品图（Image Resizing 转 JPEG，避免 Satori 不支持 WebP）
   ├─ Satori 合成 1200×630 卡片（品牌 + 标题 + 创作者 + 起价 + CTA）
   ├─ ImageResponse → PNG
   ├─ env.IMAGES 转 JPEG@82  →  150~280KB
   └─ 返回 image/jpeg + 强缓存头
   │
   ▼
用户点击卡片 → listing 页（已按 sku/variant 预选）→ Buy now
```

---

## 3. 卡片视觉设计（驱动「想要定制」）

推荐 **全幅产品图 + 底部渐变信息条**（比左右分栏更具视觉冲击力）：

- **背景**：全幅产品艺术图（Desmake 商品本身就是设计，图即卖点）
- **底部暗色渐变遮罩**（左→右透明到深，保证文字可读）
- **左上角**：Desmake 字标（白色，小号）
- **主标题**：设计名（大字、加粗，Inter/Manrope Bold TTF）
- **副行**：`by {创作者名}` + 可选 `· AI-designed` 或类目小标签
- **价格胶囊**：`From $X`（用 `money(priceCents)` 格式化；强调「From」暗示可按材质/尺寸定制加价）
- **CTA 胶囊**：`Customize & Buy →`（高对比色，如品牌橙/青）
- **评分**（仅当 `rating>0 && reviews>0`）：`★ 4.8 · 1.2k reviews`

**为什么这样能驱动定制购买**：大图触发审美冲动 → 「From $」降低门槛预期 → 「Customize & Buy」把动作框死为「定制后购买」而非「看看」→ 落地页已预选 SKU，摩擦降到最低。

---

## 4. 关键技术要点（必须处理，否则会翻车）

| 坑 | 表现 | 本方案对策 |
|---|---|---|
| **PNG 体积爆炸** | `ImageResponse` 只能出 PNG，带照片的 1200×630 常逼近 1MB，超过 WhatsApp ~300KB → 卡片被丢弃 | 用已配置的 `IMAGES` 绑定：`env.IMAGES.input(png).output({format:'image/jpeg', quality:82})` → 150–280KB |
| **Satori 不支持 WebP** | 产品图若以 WebP 喂入会 `Unsupported image type` + 浪费 CPU | 产品图经 Image Resizing 转成 `format=image/jpeg,width=1000` 后，**fetch 成 base64 data URL 内嵌**，不让 Satori 自己再发子请求 |
| **字体必须是 TTF/OTF** | Satori 需要原始字体二进制；woff2 解压会撑爆 Worker WASM 包 | `public/og-fonts/` 放 `Inter-Bold.ttf` + 一款展示字体（如 Manrope-Bold.ttf），`fetch(new URL('./Inter-Bold.ttf', import.meta.url))` 载入 |
| **每次请求现渲 Satori** | CPU 时间顶到 Worker 限额 → 社交爬虫冷抓超时/失败 | `Cache-Control: public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800`；Phase 2 渲染一次落 R2 |
| **Worker 包体变大** | `next/og` 引入 satori/resvg WASM，可能撑大 Worker | 部署后核对压缩后 < 10MiB（Paid 计划）；若超限，把 OG 拆成独立小 Worker |
| **runtime 设置** | OpenNext 下 Worker 即运行时，不需要 `export const runtime='edge'`（那是 Vercel 语义） | 只设 `size` + `contentType`；构建后实测 |
| **set-cookie 破坏缓存** | 任何 cookie 写入会让边缘缓存失效 | 本路由纯 GET 出图、无中间件，天然安全 |

---

## 5. 分阶段实施

### Phase 0 — 可行性探针（~30min，先验证再大改）
- 建 `app/og/listing/[slug]/route.tsx`，先**返回一张静态品牌卡片（不查 D1）**，走通 `next/og` + `IMAGES` PNG→JPEG。
- `curl -I` 确认返回 `image/jpeg` 且体积 < 300KB；用 Facebook/Twitter Card Debugger 实测预览。
- 确认 CI 部署后 Worker 包体未超限。

### Phase 1 — MVP（核心交付）
- 复用 `listing/[slug]/layout.tsx` 里的 `resolveDesign`（D1 `findPublishedBySlug` → `publishedToDesign`，兜底 `findListingBySlug`）取数据。
- 合成完整品牌卡片（第 3 节视觉）。
- `ogImageFor()` 改为返回 `${SITE_URL}/og/listing/${slug}`；design 缺失时回退 `/og.png`。
- 字体文件就位、Cache-Control 就位。
- 部署 → 用社交调试器 + `curl` 体积核对 + 真机分享验证。

### Phase 2 — 硬化（性能/成本，建议稍后做）
- 渲染成功后**落 R2（`BUCKET`）**，key = `og/{slug}/{BUILD_REV}.jpg`；命中直接回 R2，未命中才 Satori 渲染（每 slug 一生只渲一次）。
- 部署后**预热** Top-N 商品 OG（curl 一遍填充边缘 + R2 缓存）。
- 收益：彻底消除每次请求的 Satori CPU 开销，爬虫永不冷渲染失败。

### Phase 3 — 文案与 CTA 打磨
- 在 `ShareSheet` 内置 3–4 套**分享文案模板**（见第 6 节），默认用「创作者/定制」角度。
- 确认落地页 Hero CTA 醒目（上一轮 Buy now 已加）。
- 可选：按创作者设定卡片强调色，增强辨识度。

---

## 6. 分享文案建议（驱动定制购买欲）

卡片上的微文案（视觉层）：
- 主标题下小字：`Make it yours on Desmake`
- CTA：`Customize & Buy →`
- 价格前导：`From $X · printed on demand · ships worldwide`

`ShareSheet` 分享文本模板（用户发出去的消息）：
1. 「我设计了这个 —— 现在你也可以穿/用上它。在 Desmake 定制你的 {标题} 👉 {buy_link}」
2. 「找到心仪的 {类目}？把它变成你的。{buy_link}」
3. 创作者角度：「{创作者名} @ Desmake —— 把这幅作品印成 T 恤、海报、杯子… {buy_link}」
4. 促销/稀缺（如适用）：「限量定制 · 下单即印 · 全球直邮 {buy_link}」

> `buy_link` 即上一轮已落地的 `/api/ref?ref={handle}&to=/listing/{slug}?sku={sku}&variant={variant}`，
> 落地即预选、可直接 Buy now。

---

## 7. 需你拍板的决策点

1. **卡片版式**：全幅大图+底部信息条（推荐） vs 左右分栏（图左/信息右）。
2. **字体**：用开源 Inter / Manrope（推荐，零授权风险）还是指定品牌字体（需提供 TTF）。
3. **R2 持久化（Phase 2）**：现在就做，还是先 MVP 上线、视量再上？（推荐先 MVP）
4. **CTA 配色**：用品牌橙、品牌青，还是按创作者动态色？
5. 确认继续走 **GitHub Actions CI 部署**（类型检查以 CI 为准，本机 `tsc` 因软链布局不可用，沿用上一轮流程）。

---

## 8. 不做的事（边界）
- 不为每个 SKU 生成不同 OG 卡片：社交爬虫忽略 query，且会碎片化缓存；SKU 预选由落地页深链负责，卡片只承载「设计 + 起价 + CTA」。
- 不引入无头浏览器（Puppeteer/Playwright）截图：Satori 路径 40ms 级，远优于浏览器冷启动 2s+。
- 不新增 Cloudflare 资源（IMAGES/R2/D1 已齐备）。
