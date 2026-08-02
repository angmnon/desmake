# Desmake — 深度代码审计报告 (R1)

| 项 | 内容 |
|---|---|
| **审计对象** | Desmake（AI Native Design Marketplace）— Next.js 16.1.1 + React 19 + TypeScript，Edge Runtime |
| **代码位置** | `project_20260801_215056/projects/` |
| **审计日期** | 2026-08-01 |
| **审计方式** | 多 agent 并行只读审计（8 域）+ 主审计员 file:line 亲自复核 |
| **严格只读** | 是。全程仅 Read / Grep / Glob + 只读 Bash，零文件改动、零构建、零 install、零 git |
| **严重度口径** | 安全 + 功能正确性双视角。Critical = 完全不可用/假成功/资金可直接被盗或丢失；High = mock-only/未接线/无鉴权可滥用；Medium = 正确性 bug 有绕过；Low = 风格/可维护性 |

---

## 1. 执行摘要

**结论：这是一个高保真、可交互的前端原型，不是"已完成"的生产系统。** 用户认为"系统已经完成了开发"，但代码事实与之严重不符。

三个系统性失败贯穿全仓：

1. **交易链路整体断裂** —— 结算页用 `setTimeout(1800)` 伪造"下单成功"（清掉购物车、编一个客户端随机订单号），**从不调用** `POST /api/orders`；而订单 API 自身即便被接上也**信任客户端传来的单价**（可 0 元下单）。两端各自造假且 ID 格式互不兼容（`DM-` vs `ord_`），说明前后端从未联调。
2. **"AI 生成"是纯舞台布景** —— `POST /api/generate` 不调用任何模型、无出站请求、无密钥；`coze-coding-dev-sdk` 已装未用。所谓"输出"是把用户 prompt 当哈希种子、用浏览器端 6 模板×6 调色板的确定性 PRNG 现画 SVG。UI 上 "Running diffusion" / "waiting for GPU" / `credits_charged` 属主动虚假陈述。
3. **演示外壳掩盖持久化缺失** —— 任意 `GET /api/orders/<任意id>` 和 `GET /api/generate/<任意id>` 在查不到时**凭空捏造**一条"已送达 + 假运单号"订单 / 一个"成功"作业并返回 200，**永不 404**。这会让任何黑盒冒烟测试、任何"点一遍看看能不能跑"的验收全部通过，从而系统性掩盖后端缺失。这是本次审计最危险的设计。

此外：**全仓零认证**（含 PII 的订单详情可被任意枚举 ID 读取）；**生产构建/部署门禁在干净机器上会失败**（`next-env.d.ts` 引用未生成路径、`start.sh` 以 dev 模式启动）；**约 200+ 个凭据/数据库型传递依赖被安装却从未使用**（供应链攻击面被无谓放大）。

> 注：`AGENTS.md` 中作者自述"用户认证未实现，后续接入 Supabase Auth"，即作者本人也认定这是 MVP 原型，而非成品。

**首页可见的显性缺陷**：首页 Agent Hub 的 `<pre>` 代码块把 `<span style="color:#...">` 当纯文本整屏打印出来（HTML 标签未被解析），首屏即崩。

---

## 2. 严重度汇总

| 等级 | 数量 | 说明 |
|---|---|---|
| **Critical** | 6 | 结账假下单、价格可被篡改至 0、任意 ID 伪造订单、AI 纯伪造、构建门禁失败、零认证 |
| **High** | 17 | 见第 4 节 |
| **Medium** | ~20 | 见第 5 节（代表性列出） |
| **Low** | ~15 | 见第 5 节 |

> 同一问题被多域 agent 命中即更可信。下列 Critical/High 均经主审计员亲自 Read 复核 file:line。

---

## 3. Critical 发现

### C1 — 结算流程是假的：不下单、不落库、不跳订单页
**文件**：`src/app/checkout/page.tsx:35-43`
```tsx
const submit = (e: React.FormEvent) => {
  e.preventDefault();
  if (step === "info") { setStep("payment"); return; }
  setStep("processing");
  setTimeout(() => { cart.clear(); setStep("done"); }, 1800);   // ← 唯一"下单"动作
};
```
- 全仓 `fetch(` 仅 2 处，都在 `studio/page.tsx`，**没有任何代码调用 `POST /api/orders`**。
- 订单号 `checkout/page.tsx:28` 由 `Math.random()` 在 `useEffect` 现编（`DM-XXXX`），服务端真实 id 前缀是 `ord_`，格式不兼容。
- UI 断言 "Order confirmed." / "A confirmation email is on its way"，但无邮件、无履约、服务端零记录、刷新即丢失。
- **影响**：每一笔"支付"的收入 100% 静默丢失；且页面收集了明文卡号/CVC 后直接丢弃（见 H13）。

### C2 — 订单 API 信任客户端单价，可 0 元下单
**文件**：`src/app/api/orders/route.ts:25`（已亲自复核）
```ts
const unit = Math.max(0, Math.floor(Number(it.price_cents) || listing.priceCents));
```
服务端已通过 `it.listing_id` 查到权威 `listing.priceCents`（第 23 行），却优先采用请求体 `price_cents`，仅在其 falsy 时回退。
- `price_cents: 1` → 单价 1 分成交；
- `price_cents: -99999` → `Math.max(0, …) = 0` → 全单免费，仅剩运费。
- 无上下界、无与目录价一致性校验、无签名/报价 token。**教科书式服务端价格信任漏洞。**

### C3 — 任意 ID 伪造订单，永不 404，硬编码假运单
**文件**：`src/app/api/orders/[id]/route.ts:52-79`（已亲自复核）
```ts
if (!order) {
  const subtotal = 6400;                      // 硬编码
  ...
  order = { ..., status: "paid",
    items: [{ listing_id: "dsg_1042", variant_id: "tshirt-m", quantity: 2, unit_price_cents: 3200 }],
    manufacturing: { status, tracking: [...].includes(status) ? "1Z999AA10123456784" : null, ... } };
  try { ordersStore().set(id, order); } catch {}
}
```
- 对任意字符串返回 HTTP 200 + 一张"已付款 $77.62"订单 + 假 UPS 单号。
- 配合 `runtime="edge"` + 内存 Map：真实订单落在 isolate A、查询落到 isolate B 时必然 miss → 真实金额被这条硬编码数据静默覆盖并缓存。
- `idCreatedTs()` 对 `DM-4821-0093` 类订单号解析出 1970 年时间戳 → age 巨大 → 直接判定 `delivered`。
- **这是"用伪造数据掩盖持久化缺失"——比单纯没实现更危险**，因为它让所有验收测试通过。

### C4 — AI 生成完全伪造，无任何模型调用
**文件**：`src/app/api/generate/route.ts:15-55`、`src/app/api/generate/[id]/route.ts:28-74`、`src/components/Artwork.tsx:26-123`（已亲自复核 generate/route.ts 无模型调用）
- `POST /api/generate` 全文唯一 `await` 是 `request.json()`；无模型客户端、无出站请求、无 worker、`outputs: undefined` 后再无写入。
- 全仓 grep `coze|openai|anthropic|replicate|stability|fetch(` → 仅 studio 调自家 `/api/generate`，服务端出站请求为 0。`coze-coding-dev-sdk`（package.json:50）**零 import**。
- `GET /api/generate/[id]` 状态机纯由 `Date.now()` 减法推导（约 3.2s 必 `succeeded`），`error` 硬编码 `null`，**永不失败**；任意 id（含 `"test"`）均合成成功作业。
- 所谓产物是字符串 seed，交给 `Artwork.tsx` 的 6 模板×6 调色板确定性 PRNG 现画 SVG；prompt 仅作哈希扰动，**对语义零影响**（输入 "a cat" 与 "minimalist mountain" 得到同一类抽象色块）。
- UI 明示 "Create with AI." / "Running diffusion — X%" / `credits_charged` 属主动虚假陈述。

### C5 — 生产构建/校验门禁在干净机器上必然失败
**文件**：`next-env.d.ts:3`
```ts
import "./.next/dev/types/routes.d.ts";   // 仅 next dev 生成，next build 不产出此路径
```
- `.gitignore` 忽略 `.next`；干净机器 `ls .next` 不存在该文件。
- `tsconfig.json` `include` 了 `next-env.d.ts` 且 `strict:true`；`package.json` `validate` → `tsc -p tsconfig.json`，`.coze` 的 validate 门禁在 clone→install→validate 顺序下未跑过 `next dev` → `tsc` 报 TS2307/TS5097 直接红。
- 这是平台 CI 的硬阻断点。

### C6 — 全仓零认证/授权，写入与 PII 对匿名开放
**文件**：全仓（无 `middleware.ts`、无 `src/app/auth/`、`src/app/account/`）
- grep `getSession|signIn|next-auth|clerk|JWT|Authorization|cookie|userId|owner|401|403` → 全 0 命中。
- `POST /api/orders` 与 `POST /api/generate` 无任何 header/身份读取；`GET /api/orders/[id]` 参数名 `_req` 被刻意忽略 → 可枚举 ID 无鉴权读取他人 `customer`/`shipping.address`（PII）。
- Agent Hub（`src/app/agents/page.tsx`）纯 UI 硬编码数组，服务端零 API Key / scope / 计量 / 审计实现；首页却宣称 "Scoped permissions, per-key metering, full audit trail"。所宣称的 `orders.create`/`design.publish` 即 C1/C2 那两个裸奔端点。**宣传与实现之间存在系统性虚构。**

---

## 4. High 发现

| # | 标题 | 文件:行 | 说明 |
|---|---|---|---|
| H1 | 内存存储是持久化假象 | `src/lib/stores.ts:1-22` | `globalThis` Map 在 Edge 下每 isolate 独立、冷启动清零、无跨实例共享、无 TTL/淘汰。作者注释自认 "replace with KV/D1/R2"，但该替换从未发生。 |
| H2 | 前后端两套互斥的计费公式 | `cart/checkout:31-33` vs `orders/route.ts:38-40` | 前端 8% tax + 满$50免运(499)；后端 8% fee + 650+200×行数。同购物车差 $8.50，且 "税/费" 会计语义不同。无单一 `computeTotals` 真源。 |
| H3 | 展示价 ≠ 成交价，变体加价全丢 | `listing/[slug]/page.tsx:39,135,151` + `data.ts:156` + `cart.tsx` | 详情页按选中的 adapter 显示价（如 3D Print $68），加购却恒用 `design.priceCents`（按 adapters[0] 算，约 $12-25）。变体 `price_delta`（XL+200/A2+400）在 CartItem/购物车/subtotal 全链路丢失。 |
| H4 | 缺失页面 + 死导航链接（404） | `SiteHeader.tsx:70,77,80,106`；`DesignCard.tsx:66`；`listing/[slug]/page.tsx:103,232` | `/auth`、`/account/notifications`、`/account/wishlist` → 404；创作者主页写成 `/creator/x` 与 `/creators/x` 两种前缀但**两者路由都不存在**；无 `not-found.tsx` 兜底。对照原型 18 页仅实现 8 页（缺失 auth/account/orders/order-detail/creator/publish/works/earnings/admin/styleguide）。 |
| H5 | 生产部署以 dev 模式启动 | `scripts/start.sh:13` + `src/server.ts:5` | `start.sh` 未设 `COZE_PROJECT_ENV=PROD` → `dev = env !== 'PROD'` 为 true → `next({dev:true})`，生产 `.next` 构建被丢弃、按需编译、暴露源码/堆栈。README/AGENTS 零处提及该变量，无 `.env.example`。 |
| H6 | `.babelrc` 全局 dev-only + 生产泄露源码路径 | `.babelrc:1-15` | 强制 SWC 退场、生产用 jsx-dev-runtime；`@react-dev-inspector/babel-plugin` 向每个 JSX 注入 `data-inspector-relative-path/-line` → 生产 HTML 泄露源码路径；且该插件是 devDependency，`pnpm install --prod` 后 `next build` 硬失败。inspector middleware 从未接入，是半成品副作用。 |
| H7 | `next.config` 图片代理通配任意主机 | `next.config.ts:7-15` | `remotePatterns: hostname:'*'` 使 `/_next/image?url=https://任意主机` 成开放代理（SSRF 探测/带宽盗用）。全仓未用 `next/image`（用原生 `<img>`），纯净负债。 |
| H8 | `.npmrc` 关校验 + 第三方镜像 | `.npmrc:1-5` | `registry=registry.npmmirror.com` + `strictStorePkgContentCheck=false` + `verifyStoreIntegrity=false`：换源同时关掉完整性校验，架空 lockfile 的 integrity 防护（供应链）。 |
| H9 | ~200+ 凭据/数据库型依赖零使用 | `package.json:17-18,46,50,53-55,61` | `@aws-sdk/*`（自动探测 ~/.aws、EC2/ECS IMDS）、`supabase`、`pg`+`drizzle`、`coze-coding-dev-sdk`（拉入 openai/aws credential-provider）全部 0 import。与 `AGENTS.md` "zero Node native deps" 声明矛盾。无功能收益却放大投毒面。 |
| H10 | 内存 store 无界 + GET 可写 → DoS | `src/lib/stores.ts:16-22` | POST 每次写 + `generate/[id]`、`orders/[id]` 的**读路径也写**（key 由攻击者控制）→ 无鉴权下可循环 GET 撑爆内存。 |
| H11 | `dangerouslySetInnerHTML` palette 无校验（潜伏 XSS） | `src/components/Artwork.tsx:127-132` | SVG 由模板拼装，`fill="${c1}"` 直接注入。当前 palette 均为硬编码 hex 故安全，但 `studio/page.tsx:66`（`palette: o.palette || palette`）与 `cart.tsx:35`（localStorage 无校验）两条链路已把非静态数据接到该 sink。未来接真实模型/DB 即变存储型 XSS。 |
| H12 | 结账明文收集卡号/CVC + 虚假安全声明 | `src/app/checkout/page.tsx:132-144` | PAN/CVC 进 React state，无 tokenization/iframe/Luhn；UI 同时标 "SSL encrypted" 与 "Secure payment via Stripe"，但无 Stripe 依赖/调用。PCI 触碰面 + 误导。 |
| H13 | `STYLE_PRESETS` 非法路由导出，构建或失败 | `src/app/api/generate/route.ts:6` | Route Handler 仅允许导出 HTTP 方法 + 配置项；额外 `export const STYLE_PRESETS` 触发 Next typed-routes 类型错误，`next build` 可能直接失败。应下沉到 `src/lib/`。 |
| H14 | 购物车商品链接用 id 拼 slug → 404 | `src/app/cart/page.tsx:57` | `href={/listing/${it.listingId}}`，`listingId` 是 `dsg_1042` 之类 id，而详情页按 `slug` 查找 → 购物车每条商品名都点不回去。 |
| H15 | 首页 Agent Hub `<pre>` 打印原始 HTML 标签 | `src/app/page.tsx:352-366` | 模板字符串在 JSX 表达式里是文本节点，首页开发者展示区会原样打印一屏 `<span style="color:#c084fc">` 源码，首屏可见崩坏。 |
| H16 | 订单列表/详情页缺失，ORDERS 种子死代码 | `src/lib/data.ts:206-212` | 5 条完整订单 + ORDER_STATES 零引用；`GET /api/orders/:id` 已实现状态推进却无页面消费。用户下单后无处可查。 |
| H17 | 数量可分数/无穷，金额与明细对不上、可 null | `src/app/api/orders/route.ts:24-31` | `subtotal += unit * it.quantity`（原始值）但 `quantity: Math.floor(...)`（取整）存行项目；`quantity:1e400`→`Infinity`→JSON `null`→`{total:null}` 入库。缺 `Number.isInteger/isFinite`/上限。 |

---

## 5. Medium / Low（代表性）

**Medium**
- 无效 `listing_id` 被静默 `continue` 仍返回 201（应 400 指明哪行）。
- 订单行项目不含 adapter（产品类型），制造端不知生产 T 恤还是 3D 打印件。
- 无幂等键，重放产生重复付费订单。
- `compact()` 缺 M/B 档（1234567→"1235k"），万级四舍五入失真。
- `explore` 的 `priceMin/priceMax` state 参与 useMemo 但界面无输入框；`/?cat=` 面包屑无效。
- `aspect` 参数被接收存储但输出恒 1024×1024；UI 选 16:9 仍出方图。
- 全局 6 个自定义 class（`.tag`/`.link-with-arrow`/`.creator-card`/`.agent-band`/`.btn-sm`）在 globals.css 未定义 → 退化为无样式。
- DesignCard 显示 creator 的 handle 而非姓名（与详情页不一致）。
- `SiteHeader.tsx` 内藏第二份 `SiteFooter` 死组件（链接 `href="#"`），未来易改错文件。
- `start.sh:19-20` `kill -9` 占用端口的任意进程（共享机误杀同事服务）。
- 字体走外部 CDN `@import`（无 next/font、无 SRI），README 却称 Geist。
- Node 版本三方不一致（.coze 要 24 / @types/node ^20 / build target node20），无 `engines.node` 护栏。

**Low**
- `cart.tsx` 重复添加同款不合并，放大运费（按行数计价）。
- `checkout` 清空购物车前无 `cart.items.length===0` 守卫 → 空车可走完得 $0.00 确认。
- `page.tsx` 重复 `"use client"`；`DESIGNS.find(title==="Quiet Geometry")` 永远 undefined。
- `next-env.d.ts` 引用 dev 路径；`README` 的 `server/` 结构描述与实际不符（真实是 `src/server.ts` + `dist/`）。
- `data.ts` `money()` 负数输出 `"$-1,234.56"`、`NaN` 输出 `"$NaN"`。
- ID 熵不足（`Math.random()` 非 CSPRNG，最短可 1 字符），应改 `crypto.randomUUID()`。
- `base36` 时间戳 `slice(0,8)` 在 ~2059 年进位为 9 位后解析静默降级（不崩但全 "已送达"）。
- 演示假 API Key 字面量 `dsk_live_9f2a…3c71`（`page.tsx:359`）污染密钥扫描器，应改占位符。
- 无 CSP / 安全响应头（CSP/X-Frame-Options/Referrer-Policy 缺失）。

---

## 6. 跨域共识（多 agent 同时命中 = 高可信）

1. **持久化从未真正实现**——静态种子 + `globalThis` Map（非 DB），DB/云依赖 100% 未用。
2. **两个 `[id]` 查询端点用"伪造"替代 404**——系统性掩盖后端缺失，最危险。
3. **前端/后端是两套平行世界**——除 `/studio` 外，8 个页面零 API 调用，直接 import 种子；5 个只读 API 端点无调用方（死代码）。
4. **金额不可信**——客户端篡改、前后端公式不一致、展示价≠成交价、变体加价全丢、分数数量错账。
5. **渲染层质量高、交易/运维层是原型**——SSR/水合是本次唯一无可指摘的部分（`Artwork` 确定性 PRNG 写得很干净）。

---

## 7. P0–P3 修复路线图

### P0 — 阻断上线（资金/安全/构建，必须先做）
1. **C6/H4 接认证**：引入 Supabase Auth/better-auth + `middleware.ts` 默认拒绝，白名单放行只读端点；为 `GET /api/orders/:id` 加归属校验（否则 PII 泄露）。
2. **C2 服务端权威定价**：`orders/route.ts:25` 改为 `const unit = listing.priceCents;`，彻底不读客户端 `price_cents`。
3. **C3/C1 删除两处伪造分支**：`orders/[id]` 与 `generate/[id]` 的 miss 一律返回 404（会立即暴露真实持久化缺口，是所有后续前提）；`checkout` 改为真实 `await fetch('/api/orders', POST)` 并用服务端返回的 `order_id`/`total` 渲染确认页。
4. **C5 修 `next-env.d.ts:3`**：改为 `.next/types/routes.d.ts`，或 validate 前先 `next build`。
5. **C4 撤下 AI 虚假文案**：在接入真实模型前，移除 "diffusion/GPU/credits" 宣称，或接真实模型 + 异步作业 + 失败传播。

### P1 — 高优（正确性/合规）
6. **H5/H13** `start.sh` 加 `export COZE_PROJECT_ENV=PROD NODE_ENV=production`；`server.ts:5` 改读 `NODE_ENV`。
7. **H6** 删除 `.babelrc`（inspector 未接通），或加 env 门控。
8. **H2/H3** 抽单一 `computeTotals()` 供 cart/checkout/API 共用；listing 加购价取选中 adapter 零售价，传递 `price_delta`。
9. **H4/H14/H16** 补 `not-found.tsx`；统一创作者路径为 `/creators/[handle]`；购物车链接改用 `slug`；补 `/orders` + `/orders/[id]` 消费已有 API 与 `ORDERS`；补缺失页面（auth/account/publish 等）。
10. **H15/H17** 修首页 `<pre>`；`orders/route.ts` 加 `Number.isInteger/isFinite` + 数量上限。

### P2 — 供应链/安全卫生
11. **H8** `next.config.ts` 收窄 `remotePatterns` 为实际域名白名单或 `images.unoptimized`。
12. **H9/H8** 卸载 12 个零引用依赖（aws-sdk/supabase/pg/drizzle/coze/date-fns/dotenv/zod 等）+ 删除未使用的 `src/components/ui/**`（54 文件，独占 114 个 Radix 包）；恢复 `verifyStoreIntegrity`；镜像源谨慎评估。
13. **H11** `Artwork.tsx` palette 加 `/^#[0-9a-fA-F]{3,8}$/` 白名单，或改返回 React `<svg>` 元素树。
14. **H12** 移除卡号字段或接入真实 PSP（Stripe Elements/iframe）；删虚假安全声明。
15. 补 CSP / 安全响应头。

### P3 — 工程化收尾
16. `.npmrc` 改 `--frozen-lockfile` + 锁 `shadcn` 版本；补 `engines.node` 与 `.env.example`；修正 README 结构与字体描述；Node 版本统一；`concurrently` 落 devDependencies；`idCreatedTs` 改定长/分隔符；`useCart` 无 Provider 时抛错而非静默 no-op。

---

## 8. 值得肯定的部分（避免误报）

- **SSR/水合无可指摘**：`Artwork.tsx` 确定性 PRNG（FNV-1a + xorshift，注释明示 "no Math.random to avoid hydration mismatch"）；`cart.tsx`/`SiteHeader` 的浏览器 API 全在 effect 内；`checkout` 的 `Math.random()` 正确置于 useEffect。
- **依赖声明齐全**：`src/**` 外部 import 均在 package.json 中（无缺包导致构建失败）；Next 16.1.1 / React 19.2.3 为真实稳定版；tsconfig `strict` + `@/*` paths 配置正确。
- **API 错误边界基本正确**：两个 POST 均有 `try/catch` 结构化 400、无堆栈泄漏；`orders/route.ts` 对空 items/invalid JSON 返回 400。
- **`money()` 分→美元千分位实现正确**，整数分 + `Math.round` 无浮点累积误差。
- 脚本无硬编码绝对路径（`COZE_WORKSPACE_PATH` 兜底），可移植性干净。

---

## 9. 方法说明

- 8 个审计域并行派发（API 路由 / 数据·持久化·金额 / AI 生成 / 前端页面 / 购物车·结算·订单 / 认证授权 / 构建·配置·部署 / 安全·依赖·UI），每个 agent 严格只读、返回 file:line 证据 + 域健康度。
- 主审计员对全部 6 项 Critical 与关键 High 亲自 Read 复核 `orders/route.ts`、`orders/[id]/route.ts`、`generate/route.ts`、`checkout/page.tsx`、`next-env.d.ts`、`start.sh`、`.babelrc`，确认无误报。
- 未运行构建/install（`git` 亦非本仓库），故涉及"构建是否失败"的结论（C5/H13/H6）为基于源码与配置的高置信推断，建议以一次 `pnpm install && pnpm build && pnpm validate` 最终确认。
- 审计末 `git status --porcelain`（如有）应返回空；本次未改动任何文件。
