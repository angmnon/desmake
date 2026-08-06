// scripts/agnes_batch_publish.mjs
//
// 用线上 Desmake 的 Agnes 生图能力批量生成设计，并直接发布到 desmake 市场。
// 流程：注册/登录拿会话 cookie → 逐条 POST /api/generate（遵守 6/min 限流）
//      → 轮询 GET /api/generate/:id → POST /api/designs 发布（source:"ai"）。
//
// 为什么走线上接口而不是本地直连 Agnes：
//   - 本地没有 AGNES_API_KEY / R2 凭据（这些只在容器 env 里，由 worker.mjs #66 注入）。
//   - 线上 /api/generate 自带 Agnes key，/api/designs 自带 R2，发布后图片由服务器托管。
//   - 所有设计均为原创生成，版权归运营方，可合规上架。
//
// 用法：
//   DRY_RUN=1 node scripts/agnes_batch_publish.mjs            # 只打印计划，不落库
//   node scripts/agnes_batch_publish.mjs                       # 真实生成 + 发布
//
// 环境变量（可选）：
//   DEMAKE_BASE, MANIFEST, CATALOG_EMAIL, CATALOG_PASSWORD, GEN_INTERVAL_MS

import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DEMAKE_BASE || "https://desmake.com";
const MANIFEST = process.env.MANIFEST || path.join(import.meta.dirname, "agnes_batch.json");
const EMAIL = process.env.CATALOG_EMAIL || "catalog@desmake.local";
const PASSWORD = process.env.CATALOG_PASSWORD || "DesmakeCatalog2026!";
const GEN_INTERVAL_MS = Number(process.env.GEN_INTERVAL_MS || 11000); // 守 6/min generate 限流
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

// 当前会话 cookie（模块级，401 时自动重登刷新）。
let COOKIE = "";

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const ASPECT = manifest.aspect || "1:1";

// 扁平化成设计列表（每条独立 prompt）
const designs = [];
for (const pack of manifest.packs || []) {
  for (const v of pack.variants || []) {
    designs.push({
      pack: pack.pack,
      category: pack.category,
      adapters: pack.adapters,
      palette: pack.palette,
      title: v.title,
      prompt: v.prompt,
      tags: v.tags || [],
      description: v.description || "",
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, p, { body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get("set-cookie");
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, setCookie: sc, data };
}

// 带自动重登的鉴权请求：遇到 401（跨实例会话 miss）时重登一次再重试。
async function call(method, p, body) {
  let r = await req(method, p, { body, cookie: COOKIE });
  if (r.status === 401) {
    console.warn("    ↻ 401 会话失效，重登后重试");
    COOKIE = await ensureCookie();
    r = await req(method, p, { body, cookie: COOKIE });
  }
  return r;
}

async function ensureCookie() {
  // 注册（已存在则忽略），再登录拿 cookie。generate 只校验 session，不校验邮箱验证。
  const reg = await req("POST", "/api/auth/register", { body: { email: EMAIL, name: "Desmake Catalog", password: PASSWORD } });
  if (reg.status === 201) console.log("[auth] 已注册运营账号", EMAIL);
  else console.log("[auth] 注册跳过/已存在:", reg.status, reg.data?.error?.message || "");

  const login = await req("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  if (login.status !== 200 || !login.setCookie) {
    throw new Error("登录失败: " + login.status + " " + JSON.stringify(login.data));
  }
  const m = login.setCookie.match(/dm_session=([^;,\s]+)/);
  if (!m) throw new Error("登录响应中没有 dm_session cookie");
  COOKIE = "dm_session=" + m[1];
  console.log("[auth] 登录成功，会话就绪");
  return COOKIE;
}

async function generateOne(prompt) {
  const g = await call("POST", "/api/generate", { prompt, aspect: ASPECT, count: 1, style: "minimal" });
  if (g.status !== 202) throw new Error("generate 失败: " + g.status + " " + JSON.stringify(g.data));
  const jobId = g.data?.job_id;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const poll = await call("GET", "/api/generate/" + jobId);
    if (poll.data?.status === "succeeded") return poll.data?.outputs?.[0] || null;
    if (poll.data?.status === "failed") throw new Error("generate job 失败: " + poll.data?.error);
  }
  throw new Error("generate 轮询超时 job=" + jobId);
}

async function publishOne(d, out) {
  const body = {
    source: "ai",
    seed: out?.seed || d.title,
    palette: Array.isArray(d.palette) && d.palette.length === 3 ? d.palette : ["#0c0c0d", "#f7f6f3", "#ff4d18"],
    shape: typeof d.shape === "number" ? d.shape : 0,
    imageUrl: out?.imageUrl || "",
    title: d.title,
    category: d.category,
    adapters: d.adapters,
    prompt: d.prompt,
    description: d.description,
  };
  const r = await call("POST", "/api/designs", body);
  if (r.status !== 201) throw new Error("publish 失败: " + r.status + " " + JSON.stringify(r.data));
  return r.data;
}

async function main() {
  console.log(`\n=== Desmake 批量生图 ${DRY_RUN ? "(DRY-RUN)" : "(真实)"} ===`);
  console.log(`目标: ${BASE}  |  主题包: ${manifest.packs?.length || 0}  |  设计总数: ${designs.length}  |  限流间隔: ${GEN_INTERVAL_MS}ms`);

  if (DRY_RUN) {
    const byCat = {};
    for (const d of designs) byCat[d.category] = (byCat[d.category] || 0) + 1;
    console.log("分类分布:", JSON.stringify(byCat));
    for (const d of designs) {
      console.log(`  · [${d.pack}] ${d.title}  (${d.category})  adapters=${d.adapters.join("/")}  prompt=${d.prompt.slice(0, 48)}…`);
    }
    console.log(`\nDRY-RUN 完成：将生成并发布 ${designs.length} 条原创设计。去掉 DRY_RUN 运行即真实落库。`);
    return;
  }

  const cookie = await ensureCookie();
  COOKIE = cookie;
  let last = 0;
  let ok = 0;
  let fail = 0;
  const slugs = [];
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    // 守限流：距上次生成至少 GEN_INTERVAL_MS
    const wait = GEN_INTERVAL_MS - (Date.now() - last);
    if (last && wait > 0) { await sleep(wait); }
    last = Date.now();
    try {
      const out = await generateOne(d.prompt);
      const pub = await publishOne(d, out);
      ok++;
      slugs.push(pub.slug);
      console.log(`  ✅ [${i + 1}/${designs.length}] ${d.title} → /${pub.slug}`);
    } catch (e) {
      fail++;
      console.error(`  ❌ [${i + 1}/${designs.length}] ${d.title}: ${e.message}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功发布: ${ok}  |  失败: ${fail}  |  总计: ${designs.length}`);
  if (slugs.length) console.log("示例 slug:", slugs.slice(0, 5).join(", "), "…");
  console.log("\n✓ 发布直写 D1（权威存储），explore / listings 在所有实例立即可见，无需重启容器 rehydrate。");
  console.log("  仅当需强制全实例内存预热时才重启；D1 已保证跨实例一致性。");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
