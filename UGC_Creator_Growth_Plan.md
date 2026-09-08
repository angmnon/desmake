# Desmake UGC / 创作者增长方案（创作者侧增强）

> 目标：把 Desmake 从「平台自发货市场」升级为「创作者驱动的 UGC 增长飞轮」——
> 创作者上传 / AI 生成设计 → 一键发布成商品 → 分享出去引流获客 → 自己设计的成交拿**创作分成**，
> 分享带来的买家成交再拿**推荐分成**。让平台成为创作者「发挥创意、获取收益」的地方。

本方案基于**现有代码实测调研** + **成熟体系对标**（Etsy / Redbubble / Gumroad / Patreon / SaaS 推荐计划）。
所有改动点都精确到 `file:line`，落地时可直接照做。

---

## 0. 北极星与成功指标（North Star）

| 指标 | 含义 | 建议首期目标 |
|---|---|---|
| 活跃创作者数 | 发布 ≥1 个商品的注册用户 | +30% QoQ |
| 分享链接创建数 | 创作者主动生成的带 `?ref=` 链接 | 每位活跃创作者 ≥2/月 |
| 推荐归因订单 | 经分享链接成交的订单占比 | 10–15% GMV |
| 推荐买家转化率 | 被引流访客→下单 | ≥3% |
| 创作者收益（创作+推荐） | 双账本合计 | 持续增长、复购 |
| 创作者次月留存 | 上月发布者本月仍活跃 | ≥40% |

---

## 1. 现状调研（基于代码，可核验）

### 1.1 已有能力（可直接复用）
- **创作→发布闭环**：`/studio`（`src/app/studio/page.tsx`）AI 生成走 `/api/generate` + 轮询 `/api/generate/[id]`；上传走 `/api/upload` → `/api/designs`（`src/app/api/designs/route.ts` POST）。发布写入 `designsStore()`（内存）+ D1 `designs` 表，字段见 `PublishedDesign`（`src/lib/stores.ts`）。
- **设计数据模型**已含 `royaltyRate`(0.1–0.5，默认 0.3)、`selectedProducts`、`user_id`、`imageUrl`、`source`("ai"|"upload")。
- **创作分成账本**：`creator_earnings` 表（`src/lib/db.ts:143`）+ 内存 store；`recordOrderEarnings(order)`（`src/lib/stores.ts:362`）在支付确认 `markPaid`（`src/app/api/payments/confirm/route.ts:28`）时写入，**仅按 `creator_id`（设计owner）计 royalty**。
- **下单链路**：`/api/orders/route.ts` 在服务端解析 SKU、用 `pub.user_id` 填 `items[].creator_id`、`royalty_cents = round(net × rate)`（`:172`–`:192`）。**订单对象无 `referrer` 字段**。
- **结算**：`/api/admin/settle`（`ADMIN_TOKEN` 触发）把 `creator_earnings` 的 `pending→paid`（`src/app/api/admin/settle/route.ts`）。
- **创作者视角页**：`/account`（`src/app/account/page.tsx`）显示「我的设计」(`/api/designs`) + 创作收益摘要（仅 owner royalty）；`/payouts` 是静态营销页。

### 1.2 关键缺口（本方案要补的）
- **A. 创作者身份是「假」的**：`/creators/[handle]` 页面、`/api/creators/[handle]/route.ts`、`/creators` 营销页**全部读 `src/lib/data.ts` 里的静态 `CREATORS` / `DESIGNS` 种子数组**（`src/app/creators/[handle]/page.tsx:39` 调 `creatorByHandle`；`route.ts:6` 调 `CREATORS.find`）。真实用户的发布设计（`user_id` 维度）**没有被任何主页展示**。
- **B. 真实用户无身份字段**：`users` 表只有 `id/email/name/password_hash/role/created_at/email_verified`（`src/lib/db.ts:78`），**无 handle / bio / avatar / city / 角色标签 / 认证**。
- **C. 完全没有推荐/归因层**：全仓搜 `referral|affiliate|invite|?ref` = **0 命中**。没有分享链接、没有归因 cookie、没有推荐账本。
- **D. 没有分享入口**：商品详情 `ListingView.tsx` 只有「save」，无「share / copy link / 分享赚佣」按钮。
- **E. 没有创作者分析**：无 views / clicks / conversions / shares 统计，无法驱动「发挥创意→看收益」。
- **F. 收益只算设计owner**：推荐带来的「其他用户成交分成」未建模。

---

## 2. 成熟体系对标（设计依据）

| 体系 | 借鉴点 | 落到 Desmake |
|---|---|---|
| **Etsy / Redbubble / Society6** | 创作者上传/生成、设 royalty、平台履约、零库存、全球发货 | 已有（royalty 10–50%、全球制造网络）。强化「一键多品」+ 长尾 SEO。 |
| **Gumroad / Heroes** | 创作者自带分享链接，链接成交即分润；链接即身份 | 引入 **`?ref=<handle>` 分享链接 + 推荐账本**。 |
| **Patreon / Ko-fi / Substack** | 创作者拥有「自己的受众与主页」，关注/粉丝关系 | 引入**真实创作者主页**（作品集 + 关注数占位 + 个人简介）。 |
| **Amazon Associates / Rewardful / FirstPromoter / Dropbox-Uber 推荐** | 唯一推荐码、cookie 归因（30/60/90 天窗口）、末次点击、反自推、结算门槛 | 直接复用其**归因与反欺诈规则**做推荐分成。 |
| **Pinterest / TikTok 创作者奖励** | 原生社交分享 + 分享即内容 | listing 页「Share & Earn」浮层 + Web Share API。 |

**结论**：Desmake 已有「市场+履约+创作分成」骨架；缺的是**创作者身份资产化 + 推荐归因/推荐分成 + 分享病毒钩子**。这三块是本次方案核心。

---

## 3. 总体架构

### 3.1 身份层（让创作者「成为自己」）
```
users (已有)  ──+ handle / bio / avatar_seed / city / role_tag / verified
                          │
                          ▼
              creatorProfileByHandle(handle)  ← stores.ts 新增
                          │  (读 users + 聚合该 user_id 的真实 published designs)
                          ▼
   /creators/[handle] 真实主页  ← 重写（替换静态 CREATORS）
   /creators          发现页    ← 真实创作者 + 精选种子合并
```

### 3.2 分成与归因层（让分享「可计量、可分钱」）
```
创作者分享 ──► /api/ref?ref=<handle>&to=<url>
                 │  set cookie dm_ref=<handle> (30d, first-party, sameSite=lax)
                 │  + 记 design_events(click) / 若 to 含 listing 记 share_click
                 ▼  302 → to
买家访问（带 dm_ref）
                 │
买家下单 /api/orders  ── 读 dm_ref → referrer_id 写入 order + 每个 line
                 │
支付确认 markPaid  ──► recordOrderEarnings (owner royalty, 已有)
                  ──► recordReferralEarnings (REFERRAL ledger, 新增)  ← 核心新增
                 │
/admin/settle  ──► creator_earnings + referral_earnings 一起 pending→paid
```

---

## 4. 详细设计（六大模块）

### M1 — 真实创作者身份与主页（补缺口 A/B）
**数据层**
- `src/lib/db.ts` 用既有 `ensureOne` 模式给 `users` 加列：`handle TEXT UNIQUE`、`bio TEXT`、`avatar_seed TEXT`、`city TEXT`、`role_tag TEXT`、`verified INTEGER DEFAULT 0`、`referred_by TEXT`。
- `src/lib/session.ts` `createUser`：注册时自动生成 handle（`name` 拉丁化 + 4 位后缀，冲突则递增），写库。
- 新增 `src/lib/stores.ts`：`creatorProfileByHandle(handle)`（D1 `users WHERE handle=?`）、`designsByUser(userId)`（D1 `designs WHERE user_id=?` 解析 `data` JSON）、`updateCreatorProfile(userId, patch)`。
- 新增 `PATCH /api/account/profile`：改 handle（唯一校验）/bio/city/role_tag/avatar_seed。

**页面层**
- 重写 `src/app/creators/[handle]/page.tsx` + `src/app/api/creators/[handle]/route.ts`：数据来自真实 `creatorProfileByHandle` + `designsByUser`；**移除 `generateStaticParams`**（站点已 `force-dynamic`，动态按真实 handle 渲染，旧的静态预生成会冲突）。
- 精选种子 `CREATORS`（`src/lib/data.ts`）保留为「Desmake Select」编辑精选位，链接到 curated 介绍页，**不与真实主页混用**；旧 `/creators/<seed>` 链接仍 200（SEO 不丢）。
- 主页展示：头像(Artwork by avatar_seed)、简介、角色标签、作品集（真实 published designs）、统计卡（作品数/粉丝数占位/销量占位/评分占位）。粉丝/销量等社交信号首期用占位+真实作品数，后续接真实事件表。

### M2 — 分享与归因体系（补缺口 C/D，核心新增）
- **分享链接形态**：
  - 主页：`https://desmake.com/?ref=<handle>`
  - 商品：`https://desmake.com/listing/<slug>?ref=<handle>`
  - （可选 vanity）`/c/<handle>` → 302 到 `/?ref=<handle>`，提升可记可分享性。
  - 链接本身对 SEO 无害（canonical 忽略 query；站点已 `force-dynamic`+`no-store`）。
- **归因端点** `src/app/api/ref/route.ts`（GET）：
  - 参数 `ref`(handle) + `to`(目标路径，白名单同源)；校验 handle 存在。
  - `cookies().set("dm_ref", handle, { maxAge: 30*86400, sameSite:"lax", path:"/", httpOnly:false })`（非 httpOnly 以便前端展示「你由 @X 推荐」）。
  - 记 `design_events(share_click, ...)`（若 `to` 含 `/listing/`）。
  - `return NextResponse.redirect(to, 302)`。
  - 所有「分享」按钮的链接都先过 `/api/ref`。
- **下单捕获** `src/app/api/orders/route.ts`：
  - 读 `request.cookies.get("dm_ref")` → `resolveHandleToUserId` → `referrer_id`。
  - 写入 `order.referrer_id` 与每个 `line.referrer_id`；`attribution = referrer_id ? "ref-link" : "organic"`。
  - **反自推**：`if (referrer_id === user.id) referrer_id = null`。
- **注册记忆**（refer-a-friend）：`/api/auth/register` 若带 `?ref=`，注册后把 `referred_by` 写进该用户行，使其**未来所有订单**都归因到推荐人（即便当时未下单）。

### M3 — 推荐分成账本（补缺口 F，核心新增）
- **新表** `src/lib/db.ts` `referral_earnings`（与 `creator_earnings` 对称）：
  ```
  id, order_id, line_index, referrer_id, referred_user_id,
  source_design_slug, commission_rate REAL, base_cents INTEGER,
  commission_cents INTEGER, status TEXT DEFAULT 'pending',
  created_at TEXT, paid_at TEXT
  ```
- **写入** `src/lib/stores.ts` 新增 `recordReferralEarnings(order)`：对订单每个 line，若 `line.referrer_id` 且 `≠ buyer`，`commission_cents = round(line.net_cents × REFERRAL_RATE)`；`idempotent`（先 `DELETE WHERE order_id=?` 再插）。
- **触发**：`src/app/api/payments/confirm/route.ts` 的 `markPaid` 中，紧接 `recordOrderEarnings(order)` 之后调用 `recordReferralEarnings(order)`。
- **聚合**：`getReferralEarningsForUser(referrer_id)` / `listReferralEarningsForUser`（与现有 owner 函数同构，D1 为权威）。
- **结算**：扩展 `/api/admin/settle` 的 SQL，把 `referral_earnings` 的 `pending→paid` 一并翻转（与 `creator_earnings` 同批次）。

### M4 — 创作者仪表盘与分析（补缺口 E）
**数据层**
- `src/lib/db.ts` 新表 `design_events`（append-only，便于真实分析）：
  `id, design_slug, event TEXT('view'|'share_click'|'share_copy'|'conversion'), ip_hash TEXT, referrer_handle TEXT, ts INTEGER`。
- 聚合视图 `design_stats`（或读时聚合）：`design_slug, views, shares, clicks, conversions, owner_earned_cents, referral_earned_cents`。
- **埋点**：
  - 商品详情 Server Component 渲染时 → `fire-and-forget` 写 `design_events('view')`，**按 IP 哈希 + TTL 内存节流**（避免 D1 被打、避免 no-store 页面变慢）。
  - 分享按钮点击 → `/api/ref` 或新增 `/api/share/click` 写 `share_click`/`share_copy`。
  - 订单归因成功 → 写 `conversion`。

**接口**
- `GET /api/analytics/overview`（创作者）：作品数、总 views/shares/clicks、转化订单数、owner 收益、referral 收益、pending/paid 汇总。
- `GET /api/analytics/designs`：每个设计的 views/shares/clicks/conversions/收益。
- `GET /api/share/links`：返回我的推荐链接 + 各设计的分享链接 + 各自 clicks/sales。

**UI** — 新增 `/dashboard`（或扩展 `/account`），Tab：概览 / 我的设计（每卡片带统计+分享按钮）/ 分享赚佣（生成链接、看 clicks/sales）/ 收益（owner+referral、pending/paid）/ 提现（接 `/payouts` 说明）。

### M5 — 分享动效与获客钩子（补缺口 D， viral 层）
- **ListingView.tsx**（`src/app/listing/[slug]/ListingView.tsx`）：在「save」旁加醒目 **"Share & earn"** 按钮 → 打开分享浮层：
  - 预填 `?ref=<myhandle>` 链接 + 一键复制；
  - 社交目标：X / Pinterest / Reddit / TikTok（Web Share API + 回退手动复制）；
  - 实时小字：「X clicks · Y sales from your shares」。
- **Studio 发布成功页**（`src/app/studio/page.tsx` `publish()` 后）：加「分享去赚钱」CTA，直接打开该设计的分享浮层。
- **OG 卡片**：确认 listing 的 `og:title` 含 `by @handle`、图用 `imageUrl`/Artwork（已有 OG 基础，核对 `openGraph` 注入）。
- v1 不强制邮件/SMS；Web Share + 复制链接即可。

### M6 — /creators 发现与 SEO（收口）
- `/creators` 页：真实创作者（发布 ≥1 设计）+ 精选种子合并展示；真实者显示**实时作品数**，社交信号先占位。
- `src/app/sitemap.ts`：新增 `/creators/<handle>`（真实 + 精选），复用既有索引驱动写法。
- 保持站点 `force-dynamic`+`no-store`（已上线），杜绝 s-maxage 中毒导致新主页/新设计不被搜索引擎抓到。

---

## 5. 数据模型变更（D1，全部经 `ensureOne`/幂等 ALTER）

```sql
-- users 加列（ALTER IF NOT EXISTS 模式，沿用 db.ts:135 写法）
ALTER TABLE users ADD COLUMN handle TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_seed TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN role_tag TEXT;
ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN referred_by TEXT;

-- 推荐分成账本
CREATE TABLE IF NOT EXISTS referral_earnings (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, line_index INTEGER NOT NULL,
  referrer_id TEXT NOT NULL, referred_user_id TEXT NOT NULL,
  source_design_slug TEXT NOT NULL, commission_rate REAL NOT NULL,
  base_cents INTEGER NOT NULL, commission_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_earnings(referrer_id);

-- 行为事件（真实分析）
CREATE TABLE IF NOT EXISTS design_events (
  id TEXT PRIMARY KEY, design_slug TEXT NOT NULL, event TEXT NOT NULL,
  ip_hash TEXT, referrer_handle TEXT, ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_design_events_slug ON design_events(design_slug);
```
> `orders.data` JSON blob 增加 `referrer_id` / `attribution` 字段（写于 `/api/orders`）。

---

## 6. 分成与归因规则（建议默认，可调整）

**创作分成（已有，不动）**：设计 owner 拿 `net × royaltyRate`(10–50%)。

**推荐分成（新增）**：
- `REFERRAL_RATE` 默认 **7%**，计基 = 被推荐买家订单各 line 的 `net_cents`（与 owner royalty 同口径，平台代缴税不进基数）。
- **归因窗口**：末次点击 30 天 cookie；注册时记忆 `referred_by`（终身）。
- **归因范围**：被推荐用户的**每一笔订单**都给推荐人分润（终身、低费率），以最大化病毒系数；首期设**推荐人月度封顶**（如 $500）防滥用，后续按数据放开。
  - *备选（更保守）*：仅被推荐用户的**首单**全费率，复购 60 天内半费率。见文末「待拍板」。
- **反欺诈（硬规则，v1）**：
  1. 禁止自推：`referrer_id === buyer.id` 不记。
  2. 被推荐用户须 `email_verified=1` 才计 referral。
  3. 被推荐用户收货国家若与推荐人全部相同，标记人工复核（轻量）。
  4. 结算仍走 `ADMIN_TOKEN` 人工 `settle`，保留人工否决权。
- **可付门槛**：沿用现有最小提现门槛（建议 $10），未达阈值累计。

---

## 7. 实施路线图（分阶段，每阶段含代码改动点）

| 阶段 | 内容 | 主要改动文件 | 估时 |
|---|---|---|---|
| **P0 地基** | schema 加列 + handle 自动生成 + profile 读写 + 类型 | `db.ts`, `session.ts`, `stores.ts`, 新 `PATCH /api/account/profile` | 1–2d |
| **P1 真实主页** | 重写 `creators/[handle]` + `creators/[handle]/route.ts` + `/creators` 合并真实数据；移除 `generateStaticParams` | `creators/[handle]/*`, `creators/page.tsx`, `data.ts` | 2–3d |
| **P2 分享+归因+推荐账本** | `/api/ref` + cookie、`/api/orders` 捕获 `referrer_id`、`referral_earnings` 表+`recordReferralEarnings`、confirm 触发、settle 扩展 | `api/ref/route.ts`(新), `orders/route.ts`, `stores.ts`, `payments/confirm/route.ts`, `admin/settle/route.ts`, `db.ts` | 2–3d |
| **P3 仪表盘+分析** | `design_events` 表 + 埋点 + `/api/analytics/*` + `/dashboard` UI + listing/studio 分享浮层 | `db.ts`, `ListingView.tsx`, `studio/page.tsx`, 新 `dashboard/*`, `api/analytics/*`(新) | 3–4d |
| **P4 发现+SEO+打磨** | sitemap 加创作者、OG 核对、分享 CTA、精选「Desmake Select」收口 | `sitemap.ts`, `listing` metadata, `creators/page.tsx` | 1–2d |

**部署纪律（沿用已验证流程）**：每阶段 `bump BUILD_REV` → `wrangler deploy`（Docker 守护 + `DOCKER_CONFIG` 隔离 + Cloudflare token）→ **部署后 `purge_cache`**（站点 `force-dynamic`+`no-store`，但仍建议 purge 保一致）→ cache-busting 连测：真实 handle 主页 200、分享链接 302 且种 cookie、归因订单 `referral_earnings` 落库、仪表盘数字正确、滚动一致性。

---

## 8. 风险与护栏
- **反作弊**：见 §6 反欺诈硬规则；推荐人收益可人工冻结。
- **税务/合规**：收益达阈值走人工 settle，保留记录；多地区税务由平台代缴部分已在 `computeOrderTotals` 处理，referral 属平台营销成本，需在结算说明中明示。
- **内容质量/SEO**：UGC 爆发须防低质/违规图；发布保留现有审核位（`source`/`description`）+ 后续加举报/审核队列。站点已 `force-dynamic`，新主页/新设计即时可抓。
- **性能**：views 埋点用 IP 节流 + 内存 TTL，`design_events` 写异步，绝不阻塞 `no-store` 响应。
- **缓存**：本方案所有新增/改动页均继承根 `layout` 的 `force-dynamic`，杜绝 s-maxage 中毒（已踩过坑）。

---

## 9. 待你拍板的关键参数（不影响方案结构，仅定数值/范围）
1. **推荐分成模型**：终身低费率（7%，月度封顶 $500）**〈推荐，病毒系数高〉** vs 仅首单全费率+复购半费率（更可持续）。
2. **REFERRAL_RATE 具体值**：建议 5% / 7% / 10%。
3. **归因窗口**：30 天末次点击 + 注册记忆（推荐）vs 60/90 天。
4. **精选种子 `CREATORS`**：保留为「Desmake Select」编辑位（推荐，SEO 不丢）vs 逐步下线。
5. **仪表盘落点**：新增 `/dashboard`（推荐，职责清晰）vs 直接扩展 `/account`。

> 以上给出推荐默认值；你确认或调整后，我即可按路线图分阶段落地实现 + 部署验证。
