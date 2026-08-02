# AGENTS.md — Desmake

## 项目概览

**Desmake** — "Design once. Manufacture anywhere."
AI-native design marketplace that connects creators with a global on-demand manufacturing network. Design with AI assistance, publish once, and the network handles production, fulfillment, and shipping.

> **状态说明（重要）：本仓库是 MVP / 演示实现。** 代码审计后已修复全部 Critical/High 问题，但系统仍为单体演示，下列行为属于**真实但受限**的实现，不是伪造：
> - 认证：基于 `httpOnly` Cookie 的会话（内存 Map），`/api/orders`、`/api/generate`、`/orders`、`/account` 均受保护。
> - 定价：服务端权威，价格由 `src/lib/data.ts` 的 `unitPriceCents()` / `computeTotals()` 计算，客户端无法篡改金额。
> - "AI 生成"：确定性 SVG 生成（seed + 调色板 + 形状），**不调用任何模型、无出站请求、无密钥**。这是 MVP 视觉占位，UI 文案已去除 "diffusion / GPU / credits" 等虚假陈述。
> - 支付：演示流程，无 Stripe，无真实扣款；结算页只收集联系/收货信息并创建订单。
> - 持久化：订单 / 生成任务 / 会话均存于进程内存（`globalThis` Map）。**进程重启即丢失**，且多实例部署下不共享。生产需迁移到 KV/D1/R2 + 真实用户库。

### 技术栈
- **Framework**: Next.js 16 (App Router) — API routes 运行在 **Node runtime**（默认，不要声明 `runtime = "edge"`）
- **Core**: React 19 + TypeScript 5（strict）
- **UI**: 手写 CSS 设计系统（`src/app/globals.css`）+ Tailwind CSS 4。**不使用 shadcn/ui 或 Radix**——相关组件与依赖已在 R2 整改中全部移除
- **零 Node 原生依赖**：运行时不引入 `pg` / `aws-sdk` / `supabase` 等原生/凭据型依赖（已从 `package.json` 卸载，见下）
- **Design language**: Swiss editorial × industrial manufacturing. Warm paper (#f7f6f3), Charcoal ink (#0c0c0d), Signal orange (#ff4d18). Typography: serif italic (instrumental feel) + mono (industrial data) + sans (body).

## 目录结构

```
├── public/                 # 静态资源（logo.svg 为自定义 SVG logo）
├── src/
│   ├── app/
│   │   ├── page.tsx                # 首页（Hero + Workflow + Adapters + Stats + Featured + CTA）
│   │   ├── explore/page.tsx        # Marketplace / 探索页（筛选+网格）
│   │   ├── listing/[slug]/page.tsx # 设计详情页（产品选择+加购）
│   │   ├── studio/page.tsx         # AI 创作 Studio（生成 + 编辑器占位）
│   │   ├── creators/page.tsx       # 创作者页
│   │   ├── creators/[handle]/page.tsx # 创作者主页（server component）
│   │   ├── agents/page.tsx         # AI Agents 介绍页
│   │   ├── cart/page.tsx           # 购物车
│   │   ├── checkout/page.tsx       # 结算页（信息→确认，真实下单）
│   │   ├── auth/page.tsx           # 登录/注册（演示会话）
│   │   ├── account/page.tsx        # 账户页（读取会话）
│   │   ├── orders/page.tsx         # 我的订单（GET /api/orders）
│   │   ├── orders/[id]/page.tsx    # 订单详情（制造时间线）
│   │   ├── not-found.tsx           # 404 页
│   │   └── api/
│   │       ├── health/route.ts          # GET /api/health
│   │       ├── adapters/route.ts        # GET /api/adapters
│   │       ├── listings/route.ts        # GET /api/listings
│   │       ├── listings/[slug]/route.ts # GET /api/listings/:slug
│   │       ├── creators/[handle]/route.ts # GET /api/creators/:handle
│   │       ├── generate/route.ts        # POST /api/generate（需认证）
│   │       ├── generate/[id]/route.ts   # GET /api/generate/:id（需认证，404 for unknown）
│   │       ├── orders/route.ts          # POST /api/orders（需认证，服务端定价）+ GET 列表
│   │       ├── orders/[id]/route.ts     # GET /api/orders/:id（需认证，404 for unknown）
│   │       └── auth/
│   │           ├── login/route.ts       # POST 建立会话 + 设置 cookie
│   │           ├── logout/route.ts      # POST 销毁会话 + 清除 cookie
│   │           └── session/route.ts     # GET 当前会话用户
│   ├── components/
│   │   ├── SiteHeader.tsx        # 固定顶栏（导航 + 购物车徽标 + 移动菜单）
│   │   ├── Artwork.tsx           # 确定性 SVG 生成（调色板经 HEX 白名单校验，防 XSS）
│   │   └── DesignCard.tsx        # Marketplace 网格卡（链接到 /creators/[handle]）
│   ├── lib/
│   │   ├── data.ts               # Seed 数据 + 单一价格源 unitPriceCents()/computeTotals()/money()
│   │   ├── stores.ts             # 内存存储 + newId()（TS_WIDTH=9，时间戳解析无歧义）
│   │   ├── session.ts            # 会话模块（upsertUser/createSession/getSession/destroySession）
│   │   ├── presets.ts            # STYLE_PRESETS（从 generate 路由抽离，避免非法 route export）
│   │   ├── client-session.ts     # ensureSession() 客户端助手（演示登录）
│   │   └── cart.tsx              # 购物车 CartProvider（localStorage 持久化，按 listing+adapter+variant 合并）
│   │   └── catalog.ts            # 商品解析层：seed 设计 + Studio 已发布设计统一按 slug/id 查找
│   ├── proxy.ts                  # Next 16 proxy（原 middleware.ts）：仅 /orders、/account 的 UX 快捷跳转，**非安全边界**
│   └── server.ts                 # 自定义服务器入口（COZE_PROJECT_ENV=PROD 切生产模式）
├── scripts/                     # build.sh / dev.sh / start.sh
├── DESIGN.md
└── .env.example
```

## 核心设计与数据约定

### 产品适配器 (Adapters)
6 种核心 POD 产品：`tshirt` (DTG), `poster` (Giclée), `card` (Offset), `phonecase` (UV Print), `sticker` (Die Cut), `print3d` (FDM/SLA)。

### 设计对象 (Design)
每个设计包含：
- `seed`: 传给 `<Artwork />` 用于渲染 SVG
- `palette`: `[primary, secondary, accent]` HEX 三元组
- `shape`: 0–5 的形状类型（圆/方/字/放射等）
- `adapters`: 支持的产品 id 数组
- `priceCents`, `creator`, `category`, `tags`, `stats (sales/likes/views/rating)`

### Artwork 组件
`<Artwork seed palette shape rounded className />` 是 MVP 视觉核心。接收 seed 字符串生成确定性 SVG，避免依赖外部图像。**调色板在注入 SVG 前经 `HEX_RE` 白名单校验**，防止颜色字段 XSS。

### 定价（单一真相源）
- `unitPriceCents(design, adapterId, variant)`：基础零售价 + 变体加价（XL +250、L +100、A2 海报 +400、70×70 +500、70×100 +800、树脂 +900、方/圆卡 +200 分）。
- `computeTotals(lines)`：小计；满 5000 分或 0 免运费，否则 499 分；税 8%；返回 `{subtotalCents, shippingCents, taxCents, totalCents, freeShipping}`。
- 客户端与服务端共用同一公式；**服务端在创建订单时忽略客户端传入的任何价格字段**，杜绝改价。

## 后端 API 约定

| Method | Path | 说明 | 认证 |
|--------|------|------|------|
| GET | `/api/health` | 健康检查 + 端点清单 | 否 |
| GET | `/api/adapters` | 产品适配器列表 | 否 |
| GET | `/api/listings` | 列表搜索（q/tag/adapter/creator/category/sort/page） | 否 |
| GET | `/api/listings/:slug` | 详情 | 否 |
| GET | `/api/creators/:handle` | 创作者资料+作品 | 否 |
| POST | `/api/generate` | 提交生成任务（body: prompt, style, aspect, count）；确定性 SVG，**无模型调用** | **是** |
| GET | `/api/generate/:id` | 轮询任务进度（queued→running→succeeded）；未知 id 返回 **404** | **是** |
| POST | `/api/orders` | 创建订单；价格服务端计算；返回 `{order_id, totalCents, ...}` | **是** |
| GET | `/api/orders` | 当前用户的订单列表（按 `user_id` 过滤） | **是** |
| GET | `/api/orders/:id` | 订单详情（按年龄推进制造状态）；未知 id 返回 **404**（不再伪造） | **是** |
| POST | `/api/auth/login` | 建立演示会话，设置 `dm_session` cookie | 否 |
| POST | `/api/auth/logout` | 销毁会话 + 清除 cookie | 否 |
| GET | `/api/auth/session` | 返回当前会话用户 | 否 |

> 订单/任务/会话存储使用进程内存 `globalThis` Map；生产环境迁移到 Cloudflare KV / D1 / Queues + 真实用户库。

## 前端路由

| 路径 | 用途 | 认证 |
|------|------|------|
| `/` | 首页 | 否 |
| `/explore` | Marketplace 浏览 | 否 |
| `/listing/[slug]` | 设计详情 + 加购 | 否 |
| `/studio` | AI 创作工作室 | 否（生成时自动建立演示会话） |
| `/creators` | 创作者落地页 | 否 |
| `/creators/[handle]` | 创作者主页 | 否 |
| `/agents` | AI Agents 介绍 | 否 |
| `/cart` | 购物车 | 否 |
| `/checkout` | 结账（信息→确认，真实下单） | 否（下单时建立会话） |
| `/auth` | 登录/注册 | 否 |
| `/account` | 账户页 | **是** |
| `/orders` | 我的订单 | **是** |
| `/orders/[id]` | 订单详情 | **是** |

## 包管理
- **仅 pnpm**：`pnpm install`, `pnpm add`, `pnpm dev`, `pnpm build`, `pnpm start`
- 禁止使用 npm/yarn
- 已卸载零引用重型依赖（`@aws-sdk/*`、`@supabase/supabase-js`、`pg`、`drizzle-*`、`coze-coding-dev-sdk`、`date-fns`、`dotenv`、`@types/pg`、`react-dev-inspector*`），降低供应链投毒面。UI stub 实际引用的库（recharts/cmdk/vaul/react-hook-form/next-themes/sonner/embla-carousel/react-day-picker/input-otp/react-resizable-panels）保留。

## 常见维护点

1. **新增 seed 数据**：在 `src/lib/data.ts` 的 `RAW_DESIGNS`/`RAW_CREATORS` 中添加条目，`DESIGNS`/`CREATORS` 会自动派生。
2. **新增适配器/变体加价**：改 `ADAPTERS` 与 `variantDeltaCents()`。
3. **新增 API**：**不要**声明 `export const runtime = "edge"`。内存存储（`globalThis` Map）在 Edge Runtime 下每个隔离实例各持一份，会话与订单会随机丢失——R2/C1 已把全部 12 处 edge 声明移除，保持 Node runtime 默认值。响应通过 `NextResponse.json()`；写操作需 `import { getSession } from "@/lib/session"` 校验会话并做归属校验（`row.user_id !== user.id` → 404/403）。
4. **新增受保护路由**：真正的鉴权写在 route handler 里（`getSession()`）。`src/proxy.ts` 只是页面级 UX 快捷跳转，**不能当作安全边界**，也不匹配 `/api/*`。
5. **新增页面**：默认英文 UI；保持 Swiss editorial 风格——大标题（`.display`/`.h1`）+ mono 小标签（`.eyebrow`）+ 卡片圆角 22px + 信号色 sparingly。
6. **Cart 状态**：使用 `useCart()` hook 访问/修改购物车，会自动 localStorage 持久化并广播 `cart-updated` 事件；同一 `listing+adapter+variant` 行自动合并。

## 构建与运行

```bash
pnpm install        # 安装依赖（仅 pnpm）
pnpm dev            # 开发（HMR）
pnpm build          # 生产构建
pnpm start          # 生产运行（scripts/start.sh 设 NODE_ENV=production + COZE_PROJECT_ENV=PROD）
pnpm validate       # tsc + eslint(build) + stylelint 并行校验
```

端口通过环境变量 `PORT` / `DEPLOY_RUN_PORT` 注入，禁止硬编码。

## 已知 MVP 限制 / 后续扩展方向

- **认证**：已实现（内存会话）。生产应接入真实用户库 + 签名/加密 cookie 或 JWT；`secure` cookie 仅在 `NODE_ENV=production` 启用。
- **定价/下单**：服务端权威，已防篡改。生产接入真实支付（Stripe Checkout 等）并在服务端确认金额。
- **"AI 生成"**：确定性 SVG 占位，无模型。后续接入图像生成模型（Doubao/Seedream 等）时替换 `<Artwork />` 渲染为真实图片，并在 `generate` 路由真正调用模型。
- **持久化**：进程内存，重启即丢。生产迁移 Cloudflare KV/D1/R2。
- **创作者后台、收益仪表盘、订单追踪页等二期功能。**

## Design 规范
详见 `DESIGN.md`。核心原则：
- 纸张底色 + 墨色主文 + 信号色点缀
- 克制动画：hover 时上浮 + 阴影；无花哨粒子/渐变
- Typography 三族并置：sans（正文/标题）、serif italic（情绪词）、mono（数据/标签）
- 响应式：桌面 4 列 → 平板 2 列 → 移动 1 列
