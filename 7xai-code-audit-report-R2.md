# Desmake 深度代码审计报告 · R2

> 审计对象：`C:\Users\86189\Desktop\LQ\desmake\project_20260801_215056\projects`
> 审计日期：2026-08-01
> 轮次：R2（第二轮，深度审计）
> 方法：10 域并行只读 agent 侦查 + 主审计员逐条 file:line 源码核验
> 代码改动：**无**（严格只读审计）

---

## 0. 一句话结论

**这个项目当前既编译不过，也跑不起来。**

R1 修复了"代码看起来对不对"，R2 要回答的是"代码跑起来对不对"——答案是否定的。存在 **2 个构建阻断项**（`next build` 直接失败）和 **1 个运行时架构缺陷**（即使绕过构建，所有登录态功能在运行时 100% 失效）。此外发现一条**真实的收款金额错误链路**：用户看到 $68.00 的 3D 打印，实际被收 $32.00。

R1 的 30 项修复中 22 项为真实修复，但有 2 项修复本身**引入了新的构建阻断问题**。根因单一且明确：**从 R1 到现在，从未真正构建过一次、也从未真正下过一单**。

---

## 1. 审计方法说明：为什么 R2 能查出 R1 查不出的问题

R1 采用的是**安全视角**（谁能越权、谁能篡改价格、有没有伪造数据）。这套视角有一个盲区：它默认"代码能跑"，只审查"跑起来之后安不安全"。

R2 主动切换到**功能正确性 + 运行时语义视角**，严重度重新定义：

| 级别 | R2 判据 |
|---|---|
| Critical | 功能完全不可用 / 构建失败 / 假成功 / 收错钱 |
| High | 核心路径行为错误 / 越权 / 全站视觉退化 |
| Medium | 局部行为错误 / 可维护性风险 / 文档与代码不符 |

这次换镜头是有效的：C1（Edge 运行时隔离）和 C2/C3（构建阻断）这类问题，在安全视角下完全不会被标记为问题——因为它们"不涉及安全"，但它们让整个系统归零。

### 审计域划分（10 域并行）

```
D1 认证与会话        D6 Next16 / Edge 运行时语义
D2 订单与金额        D7 前端状态与交互闭环
D3 AI 生成链路       D8 构建 / 配置 / 依赖
D4 数据层与 ID       D9 R1 修复回归验证
D5 公共 API 契约     D10 文档漂移与死代码
```

每域产出带 file:line 证据的发现，主审计员对**全部 Critical 与关键 High 亲自 Read/Grep 复核**。下文所有条目均为**已核验**，未核验的 agent 猜测已剔除。

---

## 2. Critical 发现（5 项）

### C1 · Edge 运行时隔离，导致所有登录态功能在运行时 100% 失效

**这是本轮影响面最大的问题。**

12 条 API 路由声明了 Edge 运行时：

```
src/app/api/adapters/route.ts:4          src/app/api/auth/login/route.ts:4
src/app/api/health/route.ts:3            src/app/api/auth/logout/route.ts:4
src/app/api/listings/route.ts:4          src/app/api/auth/session/route.ts:4
src/app/api/listings/[slug]/route.ts:4   src/app/api/orders/route.ts:6
src/app/api/creators/[handle]/route.ts:4 src/app/api/orders/[id]/route.ts:5
src/app/api/generate/route.ts:6          src/app/api/generate/[id]/route.ts:6
```

而会话与订单全部存在 `globalThis` 内存 Map 中：

```ts
// src/lib/session.ts:16-31
declare global {
  var __dm_sessions: Map<string, SessionUser> | undefined;
  var __dm_users: Map<string, SessionUser> | undefined;
}
function sessions(): Map<string, SessionUser> {
  const g = globalThis as any;
  if (!g.__dm_sessions) g.__dm_sessions = new Map();
  return g.__dm_sessions as Map<string, SessionUser>;
}
```

**冲突点**：Next.js 的 Edge Runtime 是**按函数隔离**的——每个 edge function 拥有独立的 `EdgeRuntime` 沙箱和独立的 `globalThis`。`POST /api/auth/login` 把 session 写进它自己那份 `globalThis.__dm_sessions`，`POST /api/orders` 读的是**另一份完全独立的空 Map**。

**实际后果**（按用户操作顺序）：

1. 用户登录 → `login` 路由返回 200，Set-Cookie 成功
2. 前端调 `/api/auth/session` → **该路由的 globalThis 里没有这个 token → 返回 `{user:null}`**
3. 用户下单 → `/api/orders` 的 `getSession(token)` 返回 null → **401 Unauthorized**
4. 用户生成图 → `/api/generate` → **401**
5. `/orders` 页面 → **401 → 跳回 /auth**

登录、下单、生成、订单列表、账户页——**全部不可用**。这不是"演示数据不持久"的已知取舍，而是同一次请求周期内就失效的架构错误。

> 注：即使 `runtime = "edge"` 全部移除，`globalThis` 方案在多实例/serverless 下依然不可靠，但至少单进程自定义服务器（`src/server.ts`）下可以跑通。当前的 `edge` 声明让它在单进程下都跑不通。

**修复方向**：移除全部 `export const runtime = "edge"`（该项目跑在自定义 Node 服务器上，本来也用不到 Edge），或将会话改为无状态签名 cookie（JWT/HMAC），不依赖跨路由共享内存。

---

### C2 · 7 处 `Request` 类型访问 `.cookies` → TypeScript 编译失败

DOM 标准的 `Request` 类型**没有** `cookies` 属性，只有 Next.js 的 `NextRequest` 才有。以下 7 处会直接触发 `TS2339: Property 'cookies' does not exist on type 'Request'`：

| 文件 | 声明处 | 访问处 |
|---|---|---|
| `src/app/api/orders/route.ts` | :10 `POST(request: Request)` | :12 `request.cookies.get(...)` |
| `src/app/api/orders/route.ts` | :112 `GET(request: Request)` | :114 `request.cookies.get(...)` |
| `src/app/api/orders/[id]/route.ts` | :46 `GET(req: Request, ...)` | :48 `req.cookies.get(...)` |
| `src/app/api/generate/route.ts` | :8 `POST(request: Request)` | :10 `request.cookies.get(...)` |
| `src/app/api/generate/[id]/route.ts` | :20 `GET(req: Request, ...)` | :22 `req.cookies.get(...)` |
| `src/app/api/auth/session/route.ts` | :6 `GET(request: Request)` | :7 `request.cookies.get(...)` |
| `src/app/api/auth/logout/route.ts` | :6 `POST(request: Request)` | :7 `request.cookies.get(...)` |

`next.config.ts` **没有**设置 `typescript.ignoreBuildErrors`，因此 `next build` 会在类型检查阶段直接失败。

**这 7 处全部是 R1 引入的**——R1 的 C6 修复给这些 handler 加上了会话校验，但没有同步把参数类型从 `Request` 改成 `NextRequest`，也没有跑一次构建验证。

**修复**：`import type { NextRequest } from "next/server"`，7 处签名改为 `NextRequest`。

---

### C3 · `/auth` 页面 `useSearchParams()` 缺少 Suspense 边界 → 构建失败

```ts
// src/app/auth/page.tsx:5,10
import { useRouter, useSearchParams } from "next/navigation";
...
const params = useSearchParams();
```

全文件 `Suspense` 出现次数为 **0**。

Next.js App Router 在预渲染阶段会报错：
`useSearchParams() should be wrapped in a suspense boundary at page "/auth"`，导致静态生成失败、`next build` 中断。

讽刺的是，`/auth` 正是 C1、H9 的跳转落地页——中间件把未登录用户全部导向这里。

**修复**：把使用 `useSearchParams()` 的部分抽成子组件，用 `<Suspense fallback={...}>` 包裹。

---

### C4 · 购物车存"适配器显示名"，服务端按 id 解析 → 静默回落，收错金额

完整的错误传播链（四段全部核验）：

**第 1 段** — 商品页把**显示名**当 id 存进购物车：
```ts
// src/app/listing/[slug]/page.tsx:25,29,39
const adapter = adapterById(activeAdapter);          // activeAdapter 是 id，如 "print3d"
const unit = unitPriceCents(design!, activeAdapter, currentVariant);  // 用 id 算价，正确
cart.addItem({
  ...
  adapter: adapter.name,   // ← 存的是 "3D Print"（显示名），不是 "print3d"
  priceCents: unit,        // 但价格是按 print3d 算的 $68.00
});
```

**第 2 段** — 结算页把这个显示名原样发给服务端：
```ts
// src/app/checkout/page.tsx:66
adapter: it.adapter,   // 发出去的是 "3D Print"
```

**第 3 段** — 服务端把它当 id 用，且不校验：
```ts
// src/app/api/orders/route.ts:39,43
const adapterId = typeof it.adapter === "string" ? it.adapter : listing.adapters[0];  // "3D Print"
const unit = unitPriceCents(listing, adapterId, variant);
```

**第 4 段** — 查不到就**静默回落到数组第一个**：
```ts
// src/lib/data.ts:62
export const adapterById = (id: string): Adapter =>
  ADAPTERS.find((a) => a.id === id) || ADAPTERS[0];   // ADAPTERS[0] = tshirt, retailCents 3200
```

**实际金额错误**（`src/lib/data.ts:53-60` 的定价表）：

| 用户选择 | 页面显示 | 实际收款 | 差额 |
|---|---|---|---|
| 3D Print (`print3d`) | $68.00 | **$32.00** | 平台少收 $36.00 |
| Business Card (`card`) | $42.00 | **$32.00** | 平台少收 $10.00 |
| Sticker Pack (`sticker`) | $12.00 | **$32.00** | **用户多付 $20.00** |
| Poster (`poster`) | $28.00 | **$32.00** | **用户多付 $4.00** |
| Phone Case (`phonecase`) | $29.00 | **$32.00** | **用户多付 $3.00** |
| T-Shirt (`tshirt`) | $32.00 | $32.00 | 唯一正确 —— 因为它恰好是 `ADAPTERS[0]` |

6 个适配器里 5 个收错钱，其中 3 个是**多收用户的钱**。而且订单确认页显示的是服务端返回的 `data.total`，所以用户会在下单后看到一个和购物车不一致的金额。

R1 的 C2 修复"价格一律服务端计算、忽略客户端 price_cents"方向完全正确，但它没有校验**输入的 adapter 标识本身是脏的**，反而让这个错误变得权威且不可见。

**修复**：
1. `src/app/listing/[slug]/page.tsx:39` 改为 `adapter: activeAdapter`（存 id）
2. `src/lib/data.ts:62` 的 `adapterById` **不要静默回落**，改为返回 `undefined`，调用方显式处理
3. `src/app/api/orders/route.ts:39` 后增加 `if (!listing.adapters.includes(adapterId)) continue;`

---

### C5 · 所有访客共用同一个演示账号，订单互相可见

```ts
// src/lib/client-session.ts:14-18
const loginRes = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: email || "demo@desmake.app", name: "Demo User" }),
});
```

任何未登录用户触发受保护操作时，前端**自动以 `demo@desmake.app` 登录**。而：

```ts
// src/lib/session.ts:33-41
export function upsertUser(email: string, name: string): SessionUser {
  const key = email.toLowerCase();
  const existing = users().get(key);
  if (existing) { ...; return existing; }   // ← 同一 email 永远返回同一个 user.id
  ...
}
```

且 `/api/auth/login` 不校验任何凭据（仅 email 正则）。

**后果**：`GET /api/orders` 按 `o.user_id === user.id` 过滤（`src/app/api/orders/route.ts:121`）看似正确，但**所有访客的 user.id 都相同**，因此 A 用户能看到 B 用户的全部订单，包含收货地址、姓名、邮箱等 PII。过滤逻辑形同虚设。

R1 报告称"订单已做用户隔离"——技术上代码写了隔离，实际上隔离的是同一个人。

**修复**：至少给每个浏览器会话生成独立匿名身份（不复用 email 作为主键），或明确禁用自动登录、强制走 `/auth`。

---

## 3. High 发现（9 项）

### H1 · IDOR：订单详情与生成任务详情只校验登录，不校验归属

```ts
// src/app/api/orders/[id]/route.ts:46-60（已核验，无 user_id 比对）
const user = getSession(token);
if (!user) return 401;
const order = ordersStore().get(id);
if (!order) return 404;
// ↑ 到此为止，直接返回 order —— 缺少 order.user_id === user.id
```

`src/app/api/generate/[id]/route.ts:20-34` 同样缺失 job 归属校验。

任何登录用户猜到/枚举到 order_id 即可读取他人订单全文（含 `customer` PII 与 `shipping.address`）。结合 H2（ID 可预测）与 C5（共享身份），实际可利用性很高。

**修复**：两处 404 判断后各加一行归属比对，不匹配时返回 404（而非 403，避免存在性泄露）。

---

### H2 · 会话令牌使用 `Math.random()`，非密码学安全，且永不过期

```ts
// src/lib/stores.ts:26-35
const TS_WIDTH = 9;
export function newId(prefix: string): string {
  const ts = Date.now().toString(36).padStart(TS_WIDTH, "0");
  const rand = Math.random().toString(36).slice(2, 8);   // 仅 6 个 base36 字符
  ...
}
```

`createSession` 直接用 `newId("sess")` 作为 cookie 令牌（`src/lib/session.ts:52-56`）。

问题有三：
1. `Math.random()` 不是 CSPRNG，V8 的 xorshift128+ 状态可被少量输出反推
2. 随机部分仅 6 位 base36 ≈ **31 bit** 熵，前 9 位是可预测的时间戳
3. `getSession` 只做 Map 查找（`:58-61`），**没有任何过期检查**，令牌永久有效

同一个 `newId` 还用于 `ord_` / `job_` 前缀，直接造成 H1 的 ID 可枚举。

**修复**：令牌改用 `crypto.randomUUID()` 或 `crypto.getRandomValues`；会话结构增加 `expiresAt` 并在 `getSession` 中校验。

---

### H3 · 未校验 adapterId 属于该商品，可跨适配器套低价

`src/app/api/orders/route.ts:39` 取 `it.adapter` 后，**没有**校验它在 `listing.adapters` 白名单内。

例如 `Vessel Study 12`（`src/lib/data.ts:109`，仅支持 `["print3d","poster"]`，最低 $28）可以被下单为 `sticker` → 收费 $12.00。这是一条独立于 C4 的、可主动构造的低价漏洞。

**修复**：`if (!listing.adapters.includes(adapterId)) continue;`

---

### H4 · CSP 字体域名错配，全站三套网页字体被浏览器拦截

```css
/* src/app/globals.css:1 */
@import "https://fonts.googleapis.cn/css2?family=Inter:...&family=Instrument+Serif:...&family=JetBrains+Mono:...";
```

```ts
// next.config.ts:25-26
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.cn",   // ✓ 匹配
"font-src 'self' data: https://fonts.gstatic.com",                // ✗ 应为 .cn
```

`fonts.googleapis.cn` 返回的 CSS 里，`src: url(...)` 指向的是 **`fonts.gstatic.cn`**（.cn 镜像），而 `font-src` 只放行了 `fonts.gstatic.com`。

**结果**：CSS 能加载（style-src 放行），但三个字体文件全部被 CSP 拦截，浏览器控制台刷屏 `Refused to load the font`，页面回落到系统默认字体。Inter / Instrument Serif / JetBrains Mono 是这套 UI 的排版基础——**100% 的页面视觉都会退化**，"高保真"设计效果荡然无存。

**修复**：`font-src 'self' data: https://fonts.gstatic.cn https://fonts.gstatic.com`（两个都加上更稳），或改为 `next/font` 本地托管，彻底摆脱外部字体依赖。

---

### H5 · `/orders` 在真实用户零订单时**永久**显示 5 条虚构订单

```ts
// src/app/orders/page.tsx:61-75
// While loading, or if there are no live orders yet, show the sample seed orders.
const display: Row[] =
  rows && rows.length > 0
    ? rows
    : ORDERS.map((o) => ({ ... }));   // ← 硬编码种子订单
```

注意条件是 `rows.length > 0`，不是 `rows === null`。也就是说：**一个成功登录、但还没下过单的真实用户，会永久看到 5 条不属于他的假订单**，含虚构的工厂、ETA、物流单号。这比 agent 初判的"仅加载态短暂显示"严重得多——代码注释本身就承认了 "or if there are no live orders yet"。

更糟的是，R1 的 C3 修复让 `GET /api/orders/[id]` 对未知 id 正确返回 404，所以这 5 条假订单**每一条点进去都是 404**。

而 `REMEDIATION.md` 中声称"没有任何数据是伪造的"。这条声明与代码直接冲突。

**修复**：`rows === null` 时显示骨架屏，`rows.length === 0` 时显示空状态引导，删除 `ORDERS` 种子数据的渲染路径。

---

### H6 · `unitPriceCents` 忽略 `design` 参数，站内存在三套互不相同的价格

```ts
// src/lib/data.ts:269-272
export function unitPriceCents(design: Design, adapterId: string, variant = ""): number {
  const a = adapterById(adapterId);
  return a.retailCents + variantDeltaCents(adapterId, variant);   // design 完全未使用
}
```

但 `Design` 类型有自己的 `priceCents` 字段（`:38`），由随机溢价生成（`:166`），并被 explore 页的商品卡片用于展示。

**结果**：同一个设计，探索页卡片显示 $54.00，点进详情页显示 $28.00，下单收 $28.00。三个数字，两套逻辑，用户会认为是 bug 或价格欺诈。

`design` 参数保留在签名里但从不使用，说明"按设计定价"的意图存在但未实现。

**修复**：二选一——要么删掉 `Design.priceCents`，卡片改用 `unitPriceCents(d, d.adapters[0])`；要么在 `unitPriceCents` 中真正引入设计溢价。**不能两套并存。**

---

### H7 · 缺失 `pnpm-lock.yaml` + `.npmrc` 关闭完整性校验

- `pnpm-lock.yaml` **文件不存在**（R1 依赖裁剪时删除，从未重新生成）
- `.npmrc` 中保留：
  ```
  strictStorePkgContentCheck=false
  verifyStoreIntegrity=false
  ```

R1 报告将 H8（关闭完整性校验）标记为已修复——**核验结果为未修复**，两行原样保留。

同时 `.npmrc` 里 `prefer-frozen-lockfile=true` 在锁文件缺失时会**静默降级**为全新解析，配合 `resolution-mode=highest`，每次 `pnpm install` 都可能装到不同版本，且不校验包内容哈希。这是可复现构建与供应链安全的双重失守。

**修复**：删除 `verifyStoreIntegrity=false` 与 `strictStorePkgContentCheck=false` 两行；运行一次 `pnpm install` 重新生成锁文件并提交。

---

### H8 · Studio 生成结果无法下载 / 发布 / 保存 / 加购——生成链路是死胡同

```tsx
// src/app/studio/page.tsx:290-295
<button className="btn btn-sm" style={{...}}>
  <Download size={13} strokeWidth={1.8} />      {/* ← 没有 onClick */}
</button>
<Link href="/explore" className="btn btn-sm">
  Publish <ArrowRight size={13} />              {/* ← 只是跳转到探索页 */}
</Link>
```

生成流程本身能跑（轮询状态机会走到 succeeded 并渲染 Artwork），但产物**无法下载、无法发布、不入库、不能加购物车**。用户完成整个 AI 生成流程后，唯一能做的是刷新页面把它弄丢。

"AI Native Design Marketplace"的核心价值主张——生成 → 发布 → 售卖——在这里断掉了第一环。

**修复**：Download 用 SVG 序列化 + Blob 下载（`Artwork` 是纯 SVG，实现成本很低）；Publish 至少写入 `globalThis` designs store 并跳转到该设计的详情页。

---

### H9 · 中间件只校验 cookie 是否存在，不校验会话是否有效

```ts
// src/middleware.ts:21-23
const token = req.cookies.get("dm_session")?.value;
if (token) return NextResponse.next();      // ← 只要有值就放行
```

任意 HTTP 客户端发送 `Cookie: dm_session=whatever` 即可通过中间件。

对 API 路由影响有限（route handler 内部还会调 `getSession`，属纵深防御），但 **`/orders` 与 `/account` 页面组件没有任何服务端会话校验**，伪造 cookie 可直接渲染出已登录的页面外壳（叠加 H5，还会看到 5 条假订单）。

附带：`src/middleware.ts` 使用的是旧约定文件名，Next.js 16 推荐迁移到 `proxy.ts`。

**修复**：中间件内调用 `getSession(token)` 做真实校验（注意会受 C1 的 Edge 隔离影响，需与 C1 一并处理）。

---

## 4. Medium 发现（13 项）

| # | 位置 | 问题 |
|---|---|---|
| M1 | `src/app/auth/page.tsx:31` | 开放重定向：`next.startsWith("/")` 放行 `//evil.com`（协议相对 URL），可跳转到外部站点。应改为 `next.startsWith("/") && !next.startsWith("//")` |
| M2 | `src/app/studio/page.tsx:75,105` | 轮询 `setTimeout` 零清理——全文件 `useEffect` 出现次数为 **0**，组件卸载后定时器继续运行并 setState，触发 React 警告与内存泄漏 |
| M3 | `src/app/orders/page.tsx:56-59` | 在**渲染阶段**调用 `router.replace()`，违反 React 纯渲染约束，会产生 "Cannot update a component while rendering" 警告 |
| M4 | `src/lib/data.ts:248` | T-Shirt 的 L 码永远不加价：`v.includes("l ")` 带尾随空格，variant `"L"` 转小写后是 `"l"`，匹配不到。`XL` 能加价 $2.50，`L` 却是 $0 |
| M5 | `src/lib/data.ts:243-251` | `variantDeltaCents` 用子串匹配，任何包含 `xl` 的自定义 variant 字符串都会触发加价；反之精心构造的 variant 可绕过加价 |
| M6 | `src/components/ui/**` | 53 个 shadcn/ui 组件桩（6126 行），业务代码**零引用**，却拖着 41/46 个运行时依赖（主要是 Radix UI），无谓放大攻击面与安装体积 |
| M7 | `src/lib/data.ts:185-192` | `ORDER_STATES` 缺少 `routing`，但订单创建时即写入 `manufacturing.status: "routing"` 与对应 history（`api/orders/route.ts:82,94`），状态映射会落空 |
| M8 | `src/**` | 10 处 `href="#"` 死链 |
| M9 | `src/middleware.ts` | Next 16 推荐 `proxy.ts` 约定，当前文件名为旧约定 |
| M10 | `src/components/Artwork.tsx` | `HEX_RE = /^#[0-9a-fA-F]{3,8}$/` 放行非法的 5 位/7 位色值；且容器 `background: palette[2]` 未经 `safeColor` 过滤，绕过了校验 |
| M11 | `AGENTS.md` / `README.md` / `REMEDIATION.md` | 文档漂移：AGENTS.md 称 shadcn 为 UI 基座（实际零引用）；README 描述了不存在的 `server/` 目录；REMEDIATION.md 声称"无任何伪造数据"，与 H5 直接冲突 |
| M12 | `package.json` | `validate` 脚本依赖 `pnpm dlx concurrently`（未在 deps 中，需联网临时下载）；`shadcn: "latest"` 为非确定性版本 |
| M13 | `src/app/studio/page.tsx:286` | `aspect` 仅作用于 CSS 容器比例（`aspectRatio: aspect.replace(":","/")`），不参与生成参数，产物本身不随所选比例变化 |
| M14 | `src/app/globals.css` | 未分层的 `.gap-N` 类会覆盖 Tailwind 同名工具类（如 `.gap-2` 变成 4px 而非 8px），造成间距行为与 Tailwind 语义不一致 |
| M15 | `src/server.ts` | `app.prepare()` 缺少 `.catch()`，启动失败时产生未处理的 Promise rejection；无 SIGTERM 处理，容器环境下无法优雅退出 |

---

## 5. R1 修复回归验证（D9 域专项）

对 R1 报告声称的 30 项修复逐条核验：

| 结论 | 数量 | 说明 |
|---|---|---|
| ✅ 真实修复 | 22 | 含 C1（结算真实调 API）、C3/C4（未知 id 返回 404）、SSRF（`images.unoptimized`）、安全响应头等 |
| ⚠️ 部分修复 | 5 | C2、C4、H2、H3、M6 —— 方向对，但留有绕过路径 |
| ❌ 未修复 | 1 | **H8**：`.npmrc` 的 `verifyStoreIntegrity=false` / `strictStorePkgContentCheck=false` 原样保留 |
| 🔴 引入新问题 | 2 | **C6 修复**引入 7 处 `Request.cookies` 类型错误（本轮 C2，构建阻断）；**H9 依赖裁剪**删除了 `pnpm-lock.yaml` 且未重新生成（本轮 H7） |

**前轮修复可信度评分：7.3 / 10**

值得肯定的部分：R1 对"伪造成功""客户端定价""SSRF""未知 id 编造数据"这四类问题的判断和修复都是准确且有效的，依赖裁剪也确认没有误删（0 处缺失 import）。

失败的部分有一个共同根因：**所有失败项都源于"只读代码、没有真正构建和运行"**。

- 加了会话校验 → 没跑 `tsc` → 7 处类型错误
- 删了依赖 → 没跑 `pnpm install` → 锁文件永久缺失
- 修了定价 → 没真正下一单 → 没发现购物车存的是显示名
- 声明"无伪造数据" → 没打开 `/orders` 看一眼 → 5 条假订单还在

> R1 当时受沙箱文件操作限制无法执行 `pnpm install/build`，这是客观约束。但报告未将"未经构建验证"作为显式免责声明写出，导致修复结论被高估。**本轮报告在此明确标注：R2 同样未能执行构建，以下构建阻断项为静态类型推导结论，请在你本机执行验证。**

---

## 6. 跨轮趋势

| 维度 | R1 | R2 |
|---|---|---|
| 审计视角 | 安全（越权/篡改/伪造） | 功能正确性 + 运行时语义 |
| Critical | 6 | 5（全部为 R1 未覆盖的新类型） |
| High | 9 | 9 |
| Medium | 15 | 15 |
| 能否构建 | 未验证 | **否**（C2 + C3） |
| 能否跑通下单 | 未验证 | **否**（C1） |
| 金额是否正确 | 判定为"已修复" | **否**（C4，6 选 5 收错钱） |

R1 把系统从"演示外壳"推进到"逻辑合理"，R2 的结论是它**还没到"能跑"**。两轮加起来揭示的核心问题不是某个具体 bug，而是**验证方式的缺位**——没有一次端到端的真实运行。

---

## 7. 修复路线图

### P0 · 让它能编译、能跑通一单（必须优先，且必须本机验证）

1. **C2** — 7 处 handler 签名 `Request` → `NextRequest`
2. **C3** — `/auth` 抽子组件 + `<Suspense>` 包裹
3. **C1** — 移除全部 12 处 `export const runtime = "edge"`（项目跑在自定义 Node 服务器上，Edge 声明无收益却致命）
4. **C4** — 三处联动修复：`listing` 页存 id、`adapterById` 不静默回落、`orders` 路由校验白名单
5. **验收标准（缺一不可）**：
   - `pnpm install` 成功并生成 `pnpm-lock.yaml`
   - `pnpm build` **零错误**通过
   - 浏览器实操：登录 → 选 3D Print → 加购 → 结算 → 订单详情，全程金额恒为 **$68.00**
   - `/orders` 能看到这一单真实订单

### P1 · 数据正确性与越权

6. **C5** — 取消共享演示身份，每会话独立匿名身份
7. **H1** — 订单/任务详情增加归属校验
8. **H2** — 令牌改 `crypto.randomUUID()`，会话加过期时间
9. **H3** — adapter 白名单校验（可与 C4 合并）
10. **H5** — `/orders` 删除种子订单渲染路径，改骨架屏 + 空状态
11. **H6** — 统一价格来源，消除三套价格

### P2 · 体验与工程质量

12. **H4** — CSP `font-src` 补 `fonts.gstatic.cn`（或迁移 `next/font` 本地托管，更彻底）
13. **H7** — 清理 `.npmrc` 两行、重新生成并提交锁文件
14. **H8** — Studio 下载/发布落地
15. **H9** — 中间件真实校验会话
16. **M1 / M2 / M3** — 开放重定向、定时器清理、渲染期跳转

### P3 · 清理与文档

17. **M6** — 删除 53 个未引用 UI 桩及其 Radix 依赖（可显著瘦身）
18. **M4 / M5 / M7 / M10 / M13 / M14** — 定价子串匹配、状态枚举、色值校验、aspect 语义、CSS 分层
19. **M8 / M11 / M12 / M15** — 死链、文档漂移、脚本依赖、服务器健壮性

---

## 8. 审计边界声明

- 本轮**未修改任何代码**，纯只读审计。
- 因沙箱限制，**未能执行 `pnpm install` / `pnpm build` / `pnpm validate`**。C2、C3 的构建失败结论基于 TypeScript 类型系统与 Next.js App Router 已知约束的静态推导，置信度高但请在你本机复验。
- C1 的运行时失效结论基于 Next.js Edge Runtime 按函数隔离的架构事实推导，建议本机启动后用「登录 → 立即调 `/api/auth/session`」两步验证：若返回 `{user:null}`，即为实锤。
- 本报告全部条目均经主审计员亲自 Read/Grep 复核，未核验的 agent 推测已剔除。行号对应审计当日代码状态。

---

*报告结束 · R2 · 2026-08-01*
