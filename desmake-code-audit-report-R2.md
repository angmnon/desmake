# Desmake 深度代码审计报告 · R2

**审计对象**：`C:\Users\86189\Desktop\LQ\desmake\project_20260801_215056\projects`
**审计日期**：2026-09-10
**轮次**：desmake 系列第 2 轮（项目深度审计史上第 4 轮：7xai-R1 / 7xai-R2 / desmake-R1 → 本轮）
**审计范围**：Next.js 16 App Router + `@opennextjs/cloudflare`（纯 Cloudflare Workers）+ D1 + R2 + Stripe + Resend；覆盖 `src/` 全部模块与全部功能（126 个 TS/TSX 文件、30 个 API 路由、34 个 lib 模块）
**审计方式**：10 域并行只读 agent 侦查 + **主审计员逐条 `file:line` 源码 / 构建产物核验**
**代码改动**：**无**（严格只读，`git status --porcelain` 复核零改动，仅新增本报告文件）
**严重度口径**：安全 + 功能正确性并重。Critical = 资金可直接损失 / 可利用漏洞 / 功能完全不可用；High = 严重资金/安全风险、核心路径静默失效。

---

## 0. 一句话结论

> **主干防线扎实，前轮修复绝大多数经核验证实为真修；但存在 3 个 High 级"静默失效"缺陷，集中在跨 isolate（Cloudflare Workers 多实例）语义上——它们不报错、不崩溃，却在生产环境悄悄让"登出"失效、让生图配额形同虚设、让退款冲销与创作者分成在写库失败时无声丢失。**

本轮**没有发现 Critical**：两个最初被 agent 标为 High 的候选（支付 confirm 的"免费 markPaid"兜底、SESSION_SECRET 闸门）经**构建产物核验后被推翻**——Next.js 在构建期已把 `process.env.NODE_ENV` 内联为 `"production"`，导致免费分支被 dead-code 消除、密钥闸门真实生效。同时 **1 条 D10 的"持久化缺口"发现被核验为误报**（orders/designs/jobs/earnings 均已完整落 D1）。

---

## 1. 审计方法与范围

### 1.1 审计域划分（10 域并行，按功能而非文件）

| # | 域 | 覆盖的功能面 |
|---|-----|-------------|
| D1 | 认证与会话 | 登录/注册/登出/会话/邮箱验证/改密/账户页 |
| D2 | 订单·购物车·金额 | 下单、定价引擎、SKU/family/variant、税费、幂等 |
| D3 | 支付链路 | Stripe 下单、confirm、webhook、退款/拒付 |
| D4 | 分成·推荐·归因·结算 | creator/referral earnings、封顶、冲销、admin settle |
| D5 | AI 生成·上传·CDN | Agnes 生图、轮询、配额、R2 上传、/cdn、图片优化 |
| D6 | D1 数据层·跨实例 | ensureSchema、catalog 版本、索引、缓存一致性 |
| D7 | 公共 API·目录 | listings/explore/creators/designs、seo/sitemap/llms |
| D8 | 前端状态·组件 | ListingView、cart、checkout、StripeCheckout、JsonLd |
| D9 | 安全加固·合规 | CSP、限流、密钥、邮件、同意、DSAR、监控 |
| D10 | 构建·部署·文档·死代码 | next/wrangler/open-next 配置、依赖、脚本、文档漂移 |

### 1.2 核验强度说明（trust but verify）

每个域由独立只读 agent 产出带 `file:line` 的证据。主审计员随后**亲自复核全部 Critical 与关键 High**，并对**跨域矛盾**做裁决。本轮核验中：

- **推翻（误报）**：1 条 —— D10「orders/generate/earnings 仅内存、会跨实例丢失」。直读 `src/lib/stores.ts` 证实：`persistOrder`/`persistDesign`/`persistJob` 均 `INSERT ... ON CONFLICT DO UPDATE` 落 D1，`getOrder`/`getJob`/`listOrdersForUserAsync`/`allPublishedDesigns`/`catalogIndexRows` 均回落 D1，内存只是热缓存。**该发现不成立**。
- **降级（构建期内联）**：2 条 —— 见 §4。
- **确认（真修）**：前轮 R1 的多数修复经源码复核成立，见 §2。

### 1.3 限制

- 未做真机构建/运行时 HTTP 探测（沙箱限制）；构建产物核验基于容器内 `pnpm run deploy` 生成的 `.open-next/` bundle。
- 部分结论依赖"部署已注入某些 secret"（如 `SESSION_SECRET`、`STRIPE_*`），代码层正确，未逐一实测线上 secret 存在性（仅能确认代码在缺失时的 fail-closed 行为）。

---

## 2. 前轮修复核验表（R1：1 Critical + 14 High + 14 Medium）

> 复核结论均基于本轮对源码（及构建产物）的直接阅读，而非采信注释。

| 前轮项 | 复核结论 | 证据 |
|--------|----------|------|
| **C-1** 支付确认未绑定 PaymentIntent↔订单 | ✅ **真修** | `confirm/route.ts:156-166` 严格比较 `intent.metadata.order_id === orderId`；`:143-151` 校验金额/币种；intent 创建时服务端写 `metadata{order_id,user_id}`（`payments/route.ts:84`）。一笔支付无法套多单。 |
| **H-1** 创作者 JSON-LD 存储型 XSS | ✅ **真修** | `JsonLd.tsx:17-19` `safeJsonLd` 转义 `<`→`\u003c`、`>`→`\u003e`；全站 JSON-LD 仅经 `JsonLd` 输出，无第二处 `dangerouslySetInnerHTML` 注入原始 JSON。 |
| **H-2 / H-9 / H-14** 收益幂等 + 原子封顶 + fail-closed | ✅ **真修（D1 层）** | `db.ts:285-290/313-318` `UNIQUE(order_id,line_index)`；写入改 `INSERT OR IGNORE`（`stores.ts:627,838`）；月度封顶为单条 `INSERT ... SELECT ... WHERE (SELECT SUM...)<cap` 原子 SQL（`stores.ts:837-845`）；`referrerVerified` 默认 false（`stores.ts:771`）。**但** webhook 主路径吞错 → 见 **新 H-3**。 |
| **H-3** 已结算退款追扣 | ⚠️ **部分** | `reverseEarningsForOrder` 现翻 `pending`+`paid`→`reversed` 并返回 `alreadyPaid`（`stores.ts:860-903`）✅；**但** 唯一调用方 `webhook/route.ts:84` `void ...catch(()=>{})` **丢弃了 alreadyPaid**，人工追扣契约在代码中从不触发 → 见 **新 H-3**。 |
| **H-4** SSRF 白名单 | ✅ **真修（可加固）** | `designs/route.ts:135` 仅 fetch 白名单主机（`AI_IMAGE_HOSTS`/`SITE_URL`/`R2_PUBLIC_BASE_URL`），`redirect:"manual"`（`:143`）；发布上传强制同源 `/cdn/`（`:210-215`）。残留：私网/元数据 IP 黑名单不完整（低）。 |
| **H-5** `/cdn/[...key]` 前缀白名单 | ✅ **真修** | `cdn/[...key]/route.ts:15` 前缀白名单 `uploads/ ai/ public/ cms/`，`:20` 拒 `..`/前导 `/`，`:31` `nosniff`，`:33` immutable 缓存，无目录列举。 |
| **H-6** 邮件缺 `RESEND_API_KEY` 告警 | ✅ **真修（绑定已就绪）** | `wrangler.jsonc:32-37` 已声明 `send_email: EMAIL`（remote）；`email.ts` 优先走 Cloudflare `EMAIL` 绑定、Resend 兜底。残留：失败为 best-effort 一次性告警（中，见 §3）。 |
| **H-7** 会话失效（session_epoch） | ❌ **仅部分真修 → 回归为新 H-1** | `getSessionAsync`（`orders`/`payments`/`verify`/`resend`）会活取 epoch ✅；**同步 `getSession` 仍 fail-open**（`session.ts:528-529`），且 `hydrateUsersAndSessions()` 零调用点（`session.ts:187-191` 自述）→ 约 12 个端点登出失效。 |
| **H-8** 邮箱验证门控 | ⚠️ **代码就绪，默认 OFF** | `REQUIRE_EMAIL_VERIFICATION` 默认 false（`session.ts:621`）；`wrangler.jsonc` 已设 `"true"`。注意 `getSession` 携带**登录时** `emailVerified` 快照 → 需重登；money 路径已改 async 活取。 |
| **H-10** 生图配额 | ❌ **fail-open → 新 H-2** | `consumeGenerationQuota` 仅查内存 `users()`，未命中即 `{ok:true}` 放行（`session.ts:627-653`）。 |
| **H-11** 轮询超时 | ✅ **真修** | `generate/[id]/route.ts:46-51` `MAX_GEN_MS=5min` 翻转 failed；`ai.ts:55,83` `AbortSignal.timeout`。 |
| **H-12** Image Resizing 降级 | ✅ **真修** | `image-loader.ts`，`IMAGE_RESIZING_ENABLED` 兜底返回原图；`wrangler.jsonc` 已 `"true"`，线上已发 `/cdn-cgi/image/`。 |
| **H-13** SESSION_SECRET fail-closed | ✅ **真修（经构建核验）** | 源码 `session.ts:485` 以 `NODE_ENV==="production"` 为闸门；构建产物中该条件被**内联为 `true`**（见 §4.2），闸门真实生效。 |
| **M-1..M-14 / Low** | 见 §3 | 大部分成立（限流覆盖、缓存、幂等、转义、CSP 补强等），残留 3 条 Medium（限流 per-instance、CSP unsafe-inline、无 DSAR）。 |
| 历史 P0：跨实例索引失效 | ✅ 真修 | `catalogVersion.ts:60-64` D1 `catalog_meta` 原子自增；残留 1s TTL 镜像属有界延迟。 |
| 历史 P0：缓存中毒 / 运费重复计费 | ✅ 真修 | 根 layout ISR + 关键路由 `force-dynamic`；`data.ts:645` `shippingCents=0`，`total=saleSubtotal`。 |

---

## 3. 本轮新发现

> 每条均为**已核验**：`[x]` 表示主审计员亲自读过 `file:line`。

### 3.1 High（3 项）

#### H-1 · 会话 epoch 在同步 `getSession` 路径 fail-open —— 登出在生产不可靠

- **期望**：登出 / 改密 / 删号后，此前签发的无状态 token 在所有 isolate 立即失效。
- **实际**：同步 `getSession` 的 epoch 校验依赖**每 isolate 内存**的 `getUserById`；命中不到记录即**跳过校验**（源码注释明写 "Fail-open"）。而 `hydrateUsersAndSessions()`（唯一的内存回填入口）**零调用点**，故任何未在**本 isolate**登录/被 async 查过的用户，其 `users()` 记录缺失 → epoch 检查被跳过 → **旧 token 继续有效**。
- **证据**：
  - `src/lib/session.ts:528-529` `const rec = getUserById(obj.u.id); if (rec && (rec.sessionEpoch ?? 0) > (obj.u.sessionEpoch ?? 0)) return null;`（`rec` 为空即放行）
  - `src/lib/session.ts:160-163` `getUserById` 只遍历 `users()`（内存）
  - `src/lib/session.ts:187-191` 注释自述 `hydrateUsersAndSessions()` **有零个调用点**
- **影响面（同步 `getSession` 调用点）**：`account/layout.tsx:13`、`dashboard/page.tsx:19`、`orders/layout.tsx:13`、`api/profile`、`api/earnings`、`api/analytics`、`api/auth/session`、`api/designs`（`:171,364`）、`api/upload`、`api/generate`、`api/generate/[id]`、`api/share/links`。这些端点登出后仍可能被旧 cookie 访问，直到随机命中同一 isolate。
- **反例（已正确）**：`getSessionAsync`（`orders`/`orders/[id]`/`payments`/`payments/confirm`/`verify`/`resend-verification`）会 `getUserByIdAsync` 活取 D1 记录并复核 epoch，故资金路径不受影响。
- **修法**：让同步 `getSession` 在 `rec` 缺失时**fail-closed**（拒绝），或改为 D1 活取 epoch；或恢复/实现 boot 期回填。

#### H-2 · 生图配额 fail-open 且非原子 —— 配额形同虚设，可无限免费生图

- **期望**：单用户月度生图上限 `GEN_MONTHLY_CAP`（默认 200）为**硬上限**、fail-closed。
- **实际**：`consumeGenerationQuota` 只在内存在 `users()` 找用户；**未命中即返回 `{ok:true}` 放行**（任意量）。命中时计数也只在内存自增，D1 `UPDATE` 的失败被 `catch` 吞掉；允许/拒绝仅依据内存值。注释自认 "effective ceiling ≈ cap × instance-count"——但由于 `hydrateUsersAndSessions()` 零调用点，实际更接近**无限**。
- **证据**：`src/lib/session.ts:627-653`（`:630` 内存查找，`:631` `return { ok: true, remaining: GEN_MONTHLY_CAP }`，`:640-650` 吞错）；调用点 `generate/route.ts:39-45`。
- **影响**：未验证/机器账号可绕过配额，直接放大 AI 生图算力成本与滥用面。
- **修法**：`consumeGenerationQuota` 先 `await getUserByIdAsync(userId)` 载入记录；以 D1 事务 `UPDATE users SET gen_used_month=gen_used_month+1 WHERE id=? AND gen_used_month<cap` 为**真相源**并以其影响行数判定；D1 不可用即拒绝（fail-closed）。

#### H-3 · Stripe webhook 静默吞掉收益/冲销写失败，且丢弃 `alreadyPaid` 追扣信号

- **期望**（H-9/H-3 契约）：资金相关写库失败必须**告警、绝不静默**；退款订单若已被结算，必须回传 `alreadyPaid` 以便人工追扣。
- **实际**：webhook 对 `persistOrder`、`recordOrderEarnings`、`recordReferralEarnings`、`reverseEarningsForOrder` **全部** `void ....catch(() => {})`。当 webhook 是唯一写收益方（客户端未调 `/confirm`，或 confirm 的 durable 写失败而订单已 `paid` 被 `status==='pending'` 守卫跳过）时，一次 D1 抖动即**永久丢失**创作者/推荐分成；退款冲销失败则让退款订单的收益保持 `pending` → **月末照发**且无告警，直接击穿 H-3 的追扣保证。且 `alreadyPaid` 返回值被就地丢弃。
- **证据**：`src/app/api/payments/webhook/route.ts:59,62,63`（成功事件）与 `:83,84`（退款/拒付）；对照 `confirm/route.ts:32-47` 正确使用 `runDurable(...).catch(err => { recordError; notifyAlert })`。
- **修法**：webhook 三处收益/冲销调用改为与 confirm 一致（`recordError` + `notifyAlert`，并考虑重试/补偿）；捕获 `reverseEarningsForOrder` 返回的 `alreadyPaid` 并在 >0 时告警。

### 3.2 Medium（14 项）

| # | 标题 | 证据 | 影响 / 修法 |
|---|------|------|-------------|
| M-1 | 订单幂等键仅内存，不查 D1 | `orders/route.ts:343-358`（只遍历 `ordersStore()`） | 跨 isolate 重试/双击落到不同实例 → **重复 pending 订单** → 双扣风险。修：D1 加 `UNIQUE(user_id, idempotency_key)` 并以其回放。 |
| M-2 | 下单 SKU 可绕过 `selectedProducts` | `orders/route.ts:200-208`（非法 sku 回退 `adapterDefaultSku(reqAdapter)`，可落在 `allowedSkus` 之外）；`:218` 只校验 adapter 属 listing | Studio 发布若 `selectedProducts` 与 family 默认不同，买家用 `adapter` 即可买到**未上架的更便宜 family 默认 SKU**。修：`selectedProducts` 存在时，非法 sku 直接用 `allowedSkus[0]` 或拒绝，不回落 family 默认。 |
| M-3 | 税率区域由客户端断言 | `orders/route.ts:131-140`（`countryRaw || cfCountry`，checkout 恒传 country，`checkout/page.tsx:200,209`） | 买家选 US/未知国可少缴 EU VAT。注释声称 GeoIP 优先，实际客户端优先。修：优先 `cf-ipcountry`，冲突时标记/以 GeoIP 为准。 |
| M-4 | `/api/events` 无鉴权、无限流、可写 D1 | `events/route.ts:9-30`（无 `rateLimit`、无 session） | 匿名写放大 / 成本滥用。修：加 per-IP 限流（如 20/min）。 |
| M-5 | CSP `script-src 'unsafe-inline'` 无 nonce/strict-dynamic | `next.config.ts:51` | CSP 对 inline-script XSS 失去防护；仅靠源处转义（JsonLd）兜底。修：nonce 化或 `strict-dynamic`。 |
| M-6 | `dm_attrib` 未经同意即写入 + 无服务端同意记录 | `consent.ts:2-3`、`Analytics.tsx:27`、`tracking.ts:109-131`（第三方像素已按同意门控 ✅） | ePrivacy/GDPR：first-party 归因 cookie 在被拒/未决时仍写。修：`captureAttribution()` 前判 `readConsent()==='granted'`；同意落服务端（时间+版本）。 |
| M-7 | 无 DSAR / 数据导出 / 删号端点 | 全仓 grep 无 `/api/account/(export|delete)`；`privacy/page.tsx:51-53` 却承诺可申请 | GDPR Art.15/17、CCPA 承诺未落地。修：实现带鉴权的导出/删除端点 + 记录保留期。 |
| M-8 | `deleteFromR2` 死代码 + 无设计删除端点 | `r2.ts:64-73`（定义，0 调用点）；`api/designs` 仅 POST/GET | 换图/删设计产生永久 R2 孤儿，存储无界增长。修：加 owner-checked `DELETE /api/designs/[slug]`，换图时调 `deleteFromR2`。 |
| M-9 | `is_preview` 未上浮 & demo 结果被标 `aiGenerated:true` | `generate/[id]/route.ts:112` 返回 `is_preview`；`studio/page.tsx:34-40` 未消费；`designs/route.ts:199` demo 保持 `aiGenerated=true` | 占位 SVG 被当"AI 生成"展示，误导用户。修：Studio 显示 preview 标记；preview 时以 `aiGenerated:false`/`preview:true` 发布。 |
| M-10 | `catalogIndexRows` 读未 SELECT 的 `r.pstatus` | `stores.ts:353` 读 `r.pstatus`，但 SELECT（`:299-323`）**无** `json_extract(data,'$.status') AS pstatus` | 索引 `status` 恒为 `undefined`（列表/搜索索引丢失上架状态；订单守卫走 `allPublishedDesigns` 全 blob 故未受损）。修：SELECT 补该列。 |
| M-11 | 限流为 per-instance 内存 Map | `ratelimit.ts:10`（模块级 Map） | 真实上限 ≈ limit × 实例数（`max_instances=3`），非全局。修：D1/KV/DO 共享计数（尤其 `admin/settle`）。 |
| M-12 | `orders` 缺 `user_id` 索引 + `json_extract(order_id)` 反模式 | `db.ts:195-200`（仅 PK）；`stores.ts:397-399` `WHERE user_id=?` 全表扫；`stores.ts:572-575/752-755` 用 `json_extract(data,'$.order_id')` 而 `order_id` 是索引主键 | "我的订单"热路径与收益状态检查全表扫。修：加 `idx_orders_user(user_id)`；改用 `WHERE order_id=?`。 |
| M-13 | 文档漂移：`DEPLOY.md` 完全过期；`README.md`/`AGENTS.md` 描述已删除架构 | `DEPLOY.md` 述 Containers/Docker/`wrangler.toml`/`worker.mjs`/`Dockerfile`（文件均已不存在）；`README/AGENTS` 述 `src/server.ts`/`src/proxy.ts`（缺失） | 运维照文档操作会做一次错误部署且从不设 secret。修：以下发 `B1_DEPLOY_RUNBOOK.html`（准确）为准，重写/删除旧文档。 |
| M-14 | `.coze [deploy]` 跑的是 `wrangler dev` 而非部署 | `.coze:18-22` + `scripts/start.sh:11`（`opennextjs-cloudflare build && wrangler dev`） | Coze 触发的"部署"会启本地 dev，而非发布。修：入口改为 `pnpm deploy`。 |

> **补充 Medium（域内证据充分、影响较局部）**：`bumpDesignIndex` 吞错可致**永久**目录陈旧（`catalogVersion.ts:60-69` + `stores.ts:424-441`）；`admin/settle` 先改内存后写 D1 且无审计行（`settle/route.ts:51-82`）。

### 3.3 Low（12 项，摘要）

- 登录账号枚举**时序**信道（`login/route.ts:39-45`，存在用户才跑 scrypt 比对；消息已通用）。
- 注册 409 文案暴露邮箱已注册（`register/route.ts:45-50`）+ catch 可能回传内部错误文本（`:113-117`）。注册 TOCTOU：并发同邮箱首注时 `ON CONFLICT DO UPDATE` 会覆盖对方 `name/handle/bio/referred_by/acquisition_*`（**不**覆盖 password_hash，故非接管）→ 建议改 `DO NOTHING` 并按影响行数判 409。
- `/api/auth/verify` 无限流；验证 token 走 URL query（可能入日志）。
- `cmsAuth.ts:13-22` 手写比较非 `timingSafeEqual`；CMS 路由无限流。
- `home` family 无 variant 却可被客户端传 3D 变体 → **多收** $9（非平台损失），`orders/route.ts:224-228`。
- cart 的 `priceCents` 加载时不重算（仅展示层；服务端始终以 SKU 重算，价格安全）。
- `orders/[id]/route.ts:78,81` 硬编码 `fac_us-west-03` / `1Z999AA1...` 假物流号写入真实订单展示。
- 退款冻结窗口无 `orders(user_id)+status` 复合索引；`getOrderByPaymentIntent` 全 blob 扫（`stores.ts:913-915`）。
- 推荐月度封顶可**越界一笔**（预插入 SUM 判定，`stores.ts:840-845`）→ 改 `+? <= ?`。
- `idx_users_handle` UNIQUE 无去重护栏（`db.ts:258-261`），历史重复 handle 会导致每次 bootstrap 建索引失败（仅记入 `schemaFailures`）。
- `/api/adapters` 公开 `cost_cents`（`adapters/route.ts:13`）；`/api/listings` 公开 `stats` 全 0 伪造指标（`catalog.ts:47-51`）；创作者公开身份用了 **email 本地部分**（`designs/route.ts:324`）而非真实 handle。
- `llms.txt`/`llms-full.txt` 为手写静态模板，适配器价格会与 `pricing.ts` 漂移；sitemap 的 CMS 条目未过 `safeLastModified`（`sitemap.ts:143`，实际不可达 Invalid Date）。
- `.npmrc` 用第三方镜像 `registry.npmmirror.com` + `resolution-mode=highest`；`package-lock.json` 与 `pnpm-lock.yaml` 并存（前者未跟踪），README 声称的 `preinstall only-allow` 未接线。
- `monitor.ts` 告警载荷未脱敏（可能含 `job.error`=用户提示词）；`register/route.ts:94` 把 `user.email` 写日志。

---

## 4. 被核验推翻 / 降级的发现（trust-but-verify 的价值）

### 4.1 误报：D10「orders/generate/earnings 仅内存、跨实例丢失」

agent 依据"这些路由 import `stores.ts` 而非 `db.ts`"推断存在持久化缺口。**主审计员直读 `src/lib/stores.ts` 后否定**：

- `stores.ts:371-378` `persistOrder` → `INSERT INTO orders ... ON CONFLICT DO UPDATE`
- `stores.ts:424-435` `persistDesign` → `INSERT INTO designs ... ON CONFLICT DO UPDATE`
- `stores.ts:449-456` `persistJob` → `INSERT INTO generation_jobs ... ON CONFLICT DO UPDATE`
- `stores.ts:217-230/390-422/462-478/254-280/294-366` 读取均**回落 D1**
- 收益表本身就在 D1（`stores.ts:627,838` `INSERT OR IGNORE INTO creator_earnings/referral_earnings`）

结论：**内存是热缓存，D1 是真相源**，该"缺口"不成立。仅 `rate-limit Map`（M-11）与 `allPublishedDesigns` 20s 缓存属真实的有界 per-isolate 状态。

### 4.2 降级：两个"NODE_ENV 门控"候选 High → Low/Info

| 候选 | 源码 | 构建产物核验（`.open-next/server-functions/default/...`） | 裁定 |
|------|------|--------------------------|------|
| 支付 confirm「Stripe 不可用时免费 markPaid」 | `confirm/route.ts:187` `if (process.env.NODE_ENV === "production") {...503}` 否则 `:195` 免费 `markPaid` | 编译后该 chunk **`NODE_ENV` 出现 0 次**（已内联）；成功分支 return 后**直接** `return recordError(...)`，无可见 `if`；`paid_at:` 仅 2 处（幂等回放+成功），**无第三段免费返回** → 免费分支被 **DCE 消除** | **生产不可利用** → 降为 Low（构造脆弱：非 Next 构建/未来配置变更下会 fail-open，建议改为显式开关 `ALLOW_UNPAID_TEST_ORDERS`） |
| SESSION_SECRET fail-closed 以 `NODE_ENV` 为闸门 | `session.ts:485` `if (NODE_ENV==="production" && !SESSION_SECRET && !__isBuild) throw` | 编译为 `if(!process.env.SESSION_SECRET && !f) throw Error("[session] FATAL: SESSION_SECRET is required...")` —— `NODE_ENV==="production"` 被折叠消失 | **闸门真实生效**，H-13 成立；仅"依赖构建期内联"属 Info |

> 方法论意义：这两条若不做构建产物核验，会被误报为"资金可被免费套取 / 密钥可默许缺失"的 High，从而误导修复优先级。**代码审查必须穿透到构建产物**，尤其在 `NODE_ENV` 等构建期常量上。

---

## 5. 跨轮趋势

| 维度 | R2（8/01） | desmake-R1（9/05） | **本轮 R2（9/10）** |
|------|-----------|-------------------|---------------------|
| Critical | 2（构建阻断 + 运行时归零） | 1（支付绑定） | **0** |
| High | 3+ | 14 | **3** |
| Medium | — | 14 | **14** |
| 系统可用性 | 编译不过 | 可编译可下单 | 可编译、可下单、已上线 |
| 主导风险 | 从没真正跑过 | 资金/安全 | **跨 isolate 静默失效（登出/配额/资金写失败）** |

**趋势判断**：项目已从"能不能跑"过渡到"跑起来后跨实例语义是否自洽"。本轮 3 个 High **全部**是 Cloudflare Workers 多 isolate 语义下的"静默失效"——这是本阶段的主要系统性风险。前轮修复的"主干防线"（密码学、SQL 参数化、Stripe 验签、收益幂等、金额语义）经核验确实扎实。

---

## 6. 修复路线图

### P0 — 两周内（安全/资金/滥用）
1. **H-1** 会话 epoch：同步 `getSession` 在记录缺失时 fail-closed（或 D1 活取）。**最关键**，登出失效是安全底线。
2. **H-2** 生图配额：D1 事务计数为真相源 + fail-closed。
3. **H-3** webhook 收益/冲销写失败改为告警（对齐 confirm 的 `runDurable`），捕获并处置 `alreadyPaid`。
4. **M-4** `/api/events` 加限流；**M-13/M-14** 修正部署文档与 `.coze` 入口（避免误导性部署）。

### P1 — 一个月内
5. **M-1** 订单幂等 D1 化；**M-2** SKU 绕过修复；**M-3** 税率 GeoIP 优先。
6. **M-8** 加删除端点并接线 `deleteFromR2`；**M-9** 上浮 `is_preview`。
7. **M-9/M-10（D6）** 补 `orders(user_id)` 索引、改 `json_extract(order_id)` 为 PK 查询。
8. **M-5** CSP nonce 化；**M-6** 归因 cookie 同意门控；**M-7** DSAR 端点。

### P2 — 季度内
9. **M-10（D7）** 统一 public API 命名（camel vs snake）；**M-11** 限流共享存储。
10. **M-12（D10）** 移除 `@cloudflare/containers`；重写 README/AGENTS/DEPLOY。
11. `bumpDesignIndex` 失败重试/本地强制重建；`admin/settle` 先写 D1 + 审计行 + 推荐封顶边界修正。

### P3 — 技术债
12. 登录时序枚举、注册 TOCTOU/文案、CMS 恒定时间比较、home 变体多收、假物流号、公开 `cost_cents`/email 本地部分、`llms.txt` 生成化、`.npmrc`/双 lockfile/`only-allow`。

---

## 7. 方法与限制

- 10 域并行只读 agent（每域独立"枚举功能点 → 源码追踪 → file:line 证据"）+ 主审计员对全部 Critical/关键 High 及其跨域矛盾逐条复核。
- **未修改任何源码**；仅新增本报告。
- 构建产物核验基于容器内 `pnpm run deploy` 生成的 `.open-next/` bundle（`NODE_ENV` 内联、`markPaid` 免费分支 DCE、SESSION_SECRET 闸门折叠均已实测）。
- 限制：未做真机 HTTP/CWV 探测；少量结论依赖"部署已注入 secret"的假设（已标注）。

---

## 8. 修复状态（2026-09-10 一次性修复，共 58 个文件）

> 全部 3 High + 14 Medium + 12 Low 已在源码中处理。语法级校验通过（139 文件 TS transpile 无报错）。
> **类型/构建校验与部署待 Docker Desktop 启动后于 Linux 容器内执行**（本地 tsc 因 pnpm 软链 + React 类型不可解析而失真，不可作为判据）。

| 项 | 状态 | 落点 |
|---|---|---|
| H-1 会话 epoch fail-open | ✅ 13 处授权改用 `getSessionAsync` | `api/{account,dashboard,orders}/**`、`api/{analytics,auth/session,earnings,profile,share/links,upload,generate,generate/[id],designs}`；`session.ts` 同步版注释改为「禁止用于授权」 |
| H-2 生图配额 fail-open | ✅ D1 原子条件 UPDATE + fail-closed | `session.ts:consumeGenerationQuota` |
| H-3 webhook 吞资金写失败 | ✅ `runDurable` + 告警；`alreadyPaid` 处置 | `payments/webhook/route.ts`、`admin/settle/route.ts`（D1 先行 + `settle_audit`） |
| M-1 订单幂等 | ✅ D1 列 + 部分唯一索引 + 回放 | `db.ts`、`stores.ts:findOrderByIdempotencyKey`、`orders/route.ts` |
| M-2 SKU 绕过 | ✅ curated 存在时非法 sku 拒绝 | `orders/route.ts` |
| M-3 税率区域 | ✅ `cf-ipcountry` 权威 | `orders/route.ts` |
| M-4 `/api/events` 无限流 | ✅ 20/min per IP | `events/route.ts` |
| M-5 CSP nonce | ⚠️ 接受风险并文档化（nonce 会强制全站动态渲染，破坏 ISR）；源头转义已闭合 XSS | `next.config.ts` |
| M-6 dm_attrib 未同意即写 | ✅ 同意门控 + `POST /api/consent` → `consent_log` | `tracking.ts`、`consent.ts`、`Analytics.tsx`、`api/consent/route.ts` |
| M-7 无 DSAR | ✅ 导出 + 删号端点 + 账户页 UI | `api/account/export`、`api/account/delete`、`account/page.tsx` |
| M-8 R2 孤儿 / 无删除端点 | ✅ owner-checked `DELETE /api/designs/[slug]` + `deleteFromR2` | 同上；`GET /api/designs` 改读 D1 |
| M-9 `is_preview` 未上浮 | ✅ `PublishedDesign.isPreview` + Studio 徽标/横幅 | `stores.ts`、`studio/page.tsx`、`designs/route.ts` |
| M-10 `catalogIndexRows` 缺 `pstatus` | ✅ SELECT 补 `json_extract(...) AS pstatus` | `stores.ts` |
| M-11 限流 per-instance | ⚠️ 接受限制并文档化（升级路径已写明） | `ratelimit.ts` |
| M-12 `orders` 索引 / `json_extract` 反模式 | ✅ `idx_orders_user`、`payment_intent_id` 索引化查询 | `db.ts`、`stores.ts` |
| M-13 文档漂移 | ✅ 重写 `DEPLOY.md`，修正 `README.md`/`AGENTS.md` | 三文件 |
| M-14 `.coze` deploy 跑 dev | ✅ 改 `scripts/deploy.sh`（`pnpm deploy`） | `.coze`、`scripts/deploy.sh` |
| Low（12 项） | ✅ 登录时序、注册 TOCTOU/枚举、verify/CMS 限流、CMS `timingSafeEqual`、home 变体多收、假物流号、`cost_cents`/`stats`/email 本地部分、sitemap `safeLastModified`、`.npmrc`/lockfile/`preinstall`、`monitor` 脱敏、`deleteFromR2` 接线、SSRF 私网黑名单、上传 magic-byte | 见各文件 |

### 残留（需人工/架构级，非本次代码可闭环）
1. **M-5 CSP nonce**：需在「不牺牲 ISR/静态渲染」的前提下引入 nonce，属架构取舍，当前以源头转义 + 严格指令集兜底。
2. **M-11 全局限流**：需 D1/KV/DO 共享计数；接口签名已预留，替换实现即可。
3. `RESEND_API_KEY` / `STRIPE_*` / `CMS_API_KEY` 等 secret 仍需 `wrangler secret put` 到 Worker。


---

*报告生成：2026-09-10 · 严格只读审计 · 仅新增本文件*
