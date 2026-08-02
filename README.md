# projects

Desmake —— AI 原生设计市集演示应用。基于 [Next.js 16](https://nextjs.org)（App Router）+ React 19 + TypeScript 5 + Tailwind CSS 4，配自定义 Node 服务器。

> **UI 说明**：本项目脚手架最初带有 shadcn/ui + Radix 组件库，但业务代码从未引用过它们。R2 整改已移除全部 53 个未使用组件与 41 个 Radix 依赖。当前 UI 全部由 `src/app/globals.css` 中的手写设计系统 + Tailwind 工具类构成。**新增组件时不要假设 `@/components/ui/*` 存在。**

## 快速开始

> 本项目使用 **pnpm** 管理依赖。Coze 部署环境会用 `coze build` / `coze start` 包裹下面的脚本；本地开发与 CI 请直接用 pnpm。

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务器

```bash
pnpm start
```

## 演示项目状态说明（请先读）

本仓库是一个 **MVP / 演示实现**。代码审计后已修复全部 Critical/High 问题，但下述行为属于**真实但受限**的实现，并非伪造：

- **认证**：基于 `httpOnly` Cookie 的会话（进程内存 Map），写操作与 PII 端点（`/api/orders`、`/api/generate`、`/account`、`/orders`）均受保护。
- **定价**：服务端权威，价格由 `src/lib/data.ts` 的 `unitPriceCents()` / `computeTotals()` 计算，客户端无法篡改金额。
- **"AI 生成"**：确定性 SVG 生成（seed + 调色板 + 形状），**不调用任何模型、无出站请求、无密钥**，UI 文案已去除 "diffusion / GPU / credits" 等虚假陈述。
- **支付**：演示流程，无 Stripe、无真实扣款；结算页仅收集联系/收货信息并创建订单。
- **持久化**：订单 / 生成任务 / 会话存于进程内存（`globalThis` Map），进程重启即丢失。生产需迁移到 KV/D1/R2 + 真实用户库。

开发协作规范见 [`AGENTS.md`](./AGENTS.md)，视觉规范见 [`DESIGN.md`](./DESIGN.md)。

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局（挂载 SiteHeader / SiteFooter）
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式 + 手写设计系统（唯一样式来源）
│   ├── api/                 # Route Handlers（Node runtime，切勿声明 edge）
│   └── [route]/             # explore / listing / studio / cart / checkout / orders / account …
├── components/              # React 组件（全部为本项目自有，无 shadcn/Radix）
│   ├── SiteHeader.tsx
│   ├── SiteFooter.tsx
│   ├── DesignCard.tsx
│   ├── Artwork.tsx          # 确定性 SVG 生成，导出 artworkSvg() 供 Studio 下载
│   └── Inactive.tsx         # 无目的地入口的诚实占位（替代 href="#"）
├── lib/                     # 领域逻辑
│   ├── data.ts              # Seed 数据 + 唯一价格源 unitPriceCents()/computeTotals()
│   ├── catalog.ts           # seed 设计 + Studio 已发布设计的统一查找层
│   ├── stores.ts            # globalThis 内存存储 + CSPRNG id/token
│   ├── session.ts           # 会话（httpOnly cookie，7 天 TTL）
│   └── cart.tsx             # 购物车 Provider（localStorage）
├── hooks/                   # 自定义 React Hooks
├── proxy.ts                 # Next 16 proxy（原 middleware.ts）——仅 UX 跳转，非安全边界
└── server.ts                # 自定义服务器入口（构建产物为 dist/server.js）
```

> 没有独立的 `server/` 目录。服务器入口是 `src/server.ts`，由 `scripts/build.sh` 用 tsup 打包为 `dist/server.js`，`scripts/start.sh` 再以 `node dist/server.js` 启动。

## 核心开发规范

### 1. 组件开发

**使用 `globals.css` 中的设计系统类，不要引入组件库**

本项目没有 shadcn/ui、没有 Radix。UI 由 `src/app/globals.css` 里的手写类 + Tailwind 工具类组合而成：

```tsx
// ✅ 推荐：设计系统类 + Tailwind 工具类
export default function MyComponent() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="eyebrow">标签</div>
      <h3 className="h3">标题</h3>
      <p className="small muted">说明文字</p>
      <div className="row gap-3">
        <button className="btn">提交</button>
        <button className="btn btn-outline">取消</button>
      </div>
    </div>
  );
}
```

**常用设计系统类**

- 排版：`.display` `.h1`–`.h5` `.lead` `.small` `.tiny` `.mono` `.eyebrow` `.muted` `.faint`
- 布局：`.container-wide` `.container-narrow` `.section` `.section-ink` `.row` `.row-between` `.stack` `.grid` `.g-2`–`.g-5`
- 控件：`.btn` `.btn-lg` `.btn-sm` `.btn-outline` `.btn-paper` `.card` `.chip` `.tag` `.badge` `.input` `.label`
- 状态：`.dm-inactive`（无目的地入口，配合 `<Inactive>` 组件使用）

> **间距注意**：`.row` / `.grid` 等布局原语放在 `@layer components` 中，因此可以被 Tailwind 的 `gap-*` 工具类正常覆盖。曾经有一套手写的 `.gap-2 { gap: 2px }` 覆盖了 Tailwind 的同名类（8px），导致约 50 处间距静默缩水到四分之一，已在 R2 整改中删除。现在 `gap-*` 一律遵循 Tailwind 的 4px 刻度。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4，主题变量定义在 `src/app/globals.css` 的 `@theme inline` 块中（`--color-ink`、`--color-paper`、`--color-signal` 等）。

```tsx
// 使用 Tailwind 类名 + 设计系统类
<div className="row gap-4 card" style={{ padding: 16 }}>
  <button className="btn">
    主要按钮
  </button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

项目**未安装** `react-hook-form` / `zod`。表单使用受控的原生元素，并在服务端做权威校验（客户端校验只是 UX，不可信任）：

```tsx
"use client";
import { useState } from "react";

export default function MyForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/something", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErr(body?.error?.message ?? "请求失败");
      return;
    }
    // …
  }

  return (
    <form onSubmit={onSubmit} className="stack gap-3">
      <input className="input" value={email} maxLength={254}
             onChange={(e) => setEmail(e.target.value)} />
      {err && <p className="small" style={{ color: "var(--color-signal)" }}>{err}</p>}
      <button className="btn" type="submit">提交</button>
    </form>
  );
}
```

> Route handler 内必须重新校验入参，并对涉及他人数据的读取做归属校验（`row.user_id !== user.id` → 404）。

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 `globals.css` 的设计系统类构建 UI（`.container-wide` / `.section` / `.card` / `.btn` …）
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`
4. 无目的地的入口请用 `<Inactive>`，不要写 `href="#"`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件
2. 复用现有组件（`DesignCard` / `Artwork` / `Inactive`）与设计系统类，不要引入组件库
3. 使用 TypeScript 定义 Props 类型，避免 `any`

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

当前 MVP **不依赖数据库**：订单、生成任务与用户会话均存于进程内存（见 `src/lib/stores.ts`、`src/lib/session.ts`），生产环境应迁移到 Cloudflare KV/D1/R2 + 真实用户库。若后续引入 ORM，建议在 `src/lib/db.ts` 中配置，并补充相应的 schema 迁移。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router) + 自定义 Node 服务器（`src/server.ts` → tsup → `dist/server.js`）
- **UI**: 手写设计系统（`src/app/globals.css`）+ Tailwind CSS v4。无组件库
- **表单**: 原生受控组件（未安装 React Hook Form / Zod）
- **图标**: Lucide React
- **字体**: Inter / Instrument Serif / JetBrains Mono（经 `fonts.googleapis.cn` 引入，CSP 已放行 `fonts.gstatic.cn`）
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x（strict）

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- 本项目：开发规范见 [`AGENTS.md`](./AGENTS.md)，视觉规范见 [`DESIGN.md`](./DESIGN.md)，整改记录见 [`REMEDIATION.md`](./REMEDIATION.md)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **不要引入 shadcn/ui 或 Radix**；也不要 `import` `@/components/ui/*`，该目录已移除
3. **API 路由不要声明 `runtime = "edge"`**：内存存储在 Edge 隔离实例间不共享，会导致会话/订单随机丢失
4. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
5. **使用 TypeScript** 进行类型安全开发，避免 `any`
6. **使用 `@/` 路径别名** 导入模块（已配置）
