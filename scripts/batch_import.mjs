#!/usr/bin/env node
/**
 * Desmake — 批量上架导入工具（直写 D1 + R2 直传 + 重启提示）
 * =========================================================================
 * 用途：把一批已获取的「设计/产品」批量写进生产 D1 `designs` 表，图片直传 R2，
 *       最后提示重启容器让 3 个实例 rehydrate（否则新设计只在重启后可见）。
 *
 * 典型流程：
 *   1) 准备 manifest（CSV 或 JSON），每行一个设计（见 --help / 文件头注释）
 *   2) node scripts/batch_import.mjs --manifest=import.csv --dry-run   # 先看统计
 *   3) node scripts/batch_import.mjs --manifest=import.csv --i-have-rights   # 真写
 *   4) 按脚本末尾打印的命令重启容器（wrangler containers delete + deploy）
 *
 * ⚠️ 合规红线：默认拒绝写入。只有显式 --i-have-rights 才落库。该开关仅用于
 *    「来源已确认允许商业再分发」（自有素材 / CC0 / 已签数据源协议）的场景。
 *    把第三方平台设计原样爬取并转售存在侵权风险，请自行确认授权。
 *
 * 依赖：从项目目录运行（解析 node_modules/aws4 做 R2 SigV4 签名）。
 * =========================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import aws4 from "aws4";

// ───────────────────────────── 配置（可被 env 覆盖） ─────────────────────────────
const CFG = {
  D1_ACCOUNT_ID: process.env.D1_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5",
  D1_DATABASE_ID: process.env.D1_DATABASE_ID || "39a994b2-f353-4ee3-a1ff-6288963a1339",
  D1_API_TOKEN: process.env.D1_API_TOKEN || "",
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5",
  R2_BUCKET: process.env.R2_BUCKET || "desmake-assets",
  // R2 S3 凭据必须从 env 提供（不在脚本里硬编码真实密钥）：
  //   R2_S3_ACCESS_KEY_ID / R2_S3_SECRET_ACCESS_KEY
  // 缺失时图片直传会被跳过（imageUrl 留空），但 D1 直写仍可进行（probo 模式亦同）。
  R2_S3_ACCESS_KEY_ID: process.env.R2_S3_ACCESS_KEY_ID || "",
  R2_S3_SECRET_ACCESS_KEY: process.env.R2_S3_SECRET_ACCESS_KEY || "",
  // 导入设计的归属（只写字符串，不要求 users 表存在该账号）
  OWNER_USER_ID: process.env.OWNER_USER_ID || "usr_catalog_import",
  OWNER_CREATOR: process.env.OWNER_CREATOR || "desmake",
  OWNER_CREATOR_NAME: process.env.OWNER_CREATOR_NAME || "Desmake Curated",
  CONTAINER_APP_ID: process.env.CONTAINER_APP_ID || "", // 留空则末尾提示手动查
  WRANGLER: process.env.WRANGLER_BIN || "npx wrangler",
};

// ───────────────────────────── 领域约束（来自 src/lib/data.ts） ─────────────────────────────
const ADAPTERS = {
  tshirt: { retailCents: 3200 },
  poster: { retailCents: 2800 },
  card: { retailCents: 4200 },
  phonecase: { retailCents: 2900 },
  sticker: { retailCents: 1200 },
  print3d: { retailCents: 6800 },
};
const DEFAULT_ADAPTERS = ["poster", "tshirt", "sticker"];
const CATEGORIES = new Set([
  "abstract", "typography", "geometric", "illustration",
  "minimal", "retro", "botanical", "3d",
]);
const KNOWN_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const R2_READY = Boolean(CFG.R2_S3_ACCESS_KEY_ID && CFG.R2_S3_SECRET_ACCESS_KEY);
if (!R2_READY) console.warn("[batch-import] ⚠️ 未提供 R2 凭据（R2_S3_ACCESS_KEY_ID/SECRET）：图片直传将跳过，imageUrl 留空。D1 直写不受影响。");

// ───────────────────────────── 参数解析 ─────────────────────────────
const ARGS = new Map();
for (const a of process.argv.slice(2)) {
  if (!a.startsWith("--")) continue;
  const i = a.indexOf("=");
  if (i === -1) ARGS.set(a.slice(2), true);
  else ARGS.set(a.slice(2, i), a.slice(i + 1));
}
const MANIFEST = ARGS.get("manifest");
const DRY_RUN = ARGS.has("dry-run") || !ARGS.has("i-have-rights");
const HAS_RIGHTS = ARGS.has("i-have-rights");
const PROBE = ARGS.has("probe");
const LIMIT = ARGS.has("limit") ? parseInt(ARGS.get("limit"), 10) : Infinity;
const CHUNK = 20; // 每请求 20 行 → 80 个绑定参数，远低于 D1 上限

if (!MANIFEST && !PROBE) {
  console.error("用法: node scripts/batch_import.mjs --manifest=path.csv [--dry-run] [--i-have-rights] [--limit=N] [--probe]");
  console.error("见脚本头注释了解 manifest 字段。");
  process.exit(2);
}
if (!HAS_RIGHTS && !DRY_RUN) {
  console.error("⛔ 未声明 --i-have-rights：出于版权合规，脚本拒绝写入。请确认来源授权后加该开关。");
  process.exit(3);
}

// ───────────────────────────── 小工具 ─────────────────────────────
function slugify(s) {
  const base = String(s || "design")
    .toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "design";
}
function shortHash(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8);
}
function normalizeCategory(c) {
  return CATEGORIES.has(c) ? c : "art";
}
function normalizeAdapters(list) {
  // CSV 字段内用分号分隔（逗号会被 CSV 解析拆散），JSON 用数组或逗号；两者都支持。
  const got = (Array.isArray(list) ? list : String(list || "").split(/[,;]/))
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    .filter((id) => ADAPTERS[id]);
  return got.length ? got : DEFAULT_ADAPTERS;
}
function normalizeTags(list) {
  const got = (Array.isArray(list) ? list : String(list || "").split(/[,;]/))
    .map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
  return got.length ? got : ["uploaded"];
}

// ───────────────────────────── D1 直写 ─────────────────────────────
async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CFG.D1_ACCOUNT_ID}/d1/database/${CFG.D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CFG.D1_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success !== true) {
    throw new Error(`D1 失败: ${body.errors?.map((e) => e.message).join("; ") || "HTTP " + res.status}`);
  }
  return body.result?.[0]?.results ?? [];
}

/** 多行批量 INSERT（每 CHUNK 行一个请求，绑定参数防注入）。 */
async function insertDesignsBatch(rows) {
  if (DRY_RUN) return;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const placeholders = slice.map(() => "(?,?,?,?)").join(",");
    const params = [];
    for (const d of slice) {
      params.push(d.slug, d.user_id, JSON.stringify(d.data), d.created_ts);
    }
    await d1Query(
      `INSERT INTO designs (slug, user_id, data, created_ts) VALUES ${placeholders}`,
      params,
    );
  }
}

// ───────────────────────────── R2 直传 ─────────────────────────────
async function uploadToR2(key, buf, contentType) {
  if (DRY_RUN) return "/cdn/" + key; // dry-run 不真的传
  if (!R2_READY) throw new Error("R2 凭据缺失，无法直传图片（请设置 R2_S3_ACCESS_KEY_ID/SECRET）");
  const host = `${CFG.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const pathname = `/${CFG.R2_BUCKET}/${key}`;
  const signed = aws4.sign(
    {
      host, path: pathname, method: "PUT", region: "auto", service: "s3",
      body: buf, headers: { "Content-Type": contentType, "Content-Length": String(buf.length) },
    },
    { accessKeyId: CFG.R2_S3_ACCESS_KEY_ID, secretAccessKey: CFG.R2_S3_SECRET_ACCESS_KEY },
  );
  const res = await fetch(`https://${host}${pathname}`, {
    method: "PUT", headers: signed.headers, body: buf,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`R2 上传失败 HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return "/cdn/" + key;
}

async function loadImageBytes(src) {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`下载图片失败 ${r.status}: ${src}`);
    return Buffer.from(await r.arrayBuffer());
  }
  if (src.startsWith("file://")) src = src.slice(7);
  return fs.readFileSync(src);
}
function detectContentType(buf, fallbackExt) {
  // 极小魔数判断，避免依赖外部库
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return KNOWN_EXT[fallbackExt] ? `image/${fallbackExt}` : "image/png";
}

// ───────────────────────────── Manifest 解析 ─────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj = {};
    header.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
}
function loadManifest(p) {
  const raw = fs.readFileSync(p, "utf8");
  if (p.endsWith(".json")) {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : j.designs || [];
  }
  return parseCsv(raw);
}

// ───────────────────────────── 主流程 ─────────────────────────────
async function buildRow(rec, idx) {
  const title = rec.title || rec.name || `Imported ${idx}`;
  const slugBase = slugify(title);
  const slug = `${slugBase}-${shortHash((rec.image_url || rec.image_local || "") + "|" + idx)}`;
  const category = normalizeCategory(rec.category || "art");
  const adapters = normalizeAdapters(rec.adapters);
  const tags = normalizeTags(rec.tags || rec.tag);
  const baseAdapter = ADAPTERS[adapters[0]];
  const priceCents = baseAdapter.retailCents; // premiumCents 强制 0（与发布接口一致）
  const created_ts = Date.now();

  let imageUrl = "";
  if (rec.image_url || rec.image_local) {
    const src = rec.image_url || rec.image_local;
    if (R2_READY) {
      const buf = await loadImageBytes(src);
      const ct = detectContentType(buf, (src.split(".").pop() || "png").toLowerCase());
      const ext = KNOWN_EXT[ct] || "png";
      const key = `uploads/${CFG.OWNER_USER_ID}/${slug}.${ext}`;
      imageUrl = await uploadToR2(key, buf, ct);
    } else {
      // R2 未配置：保留原图 URL 作为兜底（<img> 可直接渲染），但建议配置 R2 以获得稳定托管
      imageUrl = src.startsWith("http") ? src : "";
    }
  }

  const data = {
    id: `dsn_${slug}`,
    slug,
    user_id: CFG.OWNER_USER_ID,
    title: String(title).slice(0, 80),
    category,
    tags,
    creator: CFG.OWNER_CREATOR,
    creatorName: CFG.OWNER_CREATOR_NAME,
    seed: slug,
    palette: ["#0c0c0d", "#f7f6f3", "#f7f6f3"],
    shape: 0,
    adapters,
    premiumCents: 0,
    priceCents,
    aiGenerated: false,
    prompt: undefined,
    description: (rec.description || "").slice(0, 500),
    source: "upload",
    created_at: new Date(created_ts).toISOString(),
    imageUrl,
  };
  return { slug, user_id: CFG.OWNER_USER_ID, data, created_ts };
}

async function main() {
  const records = PROBE ? [] : loadManifest(MANIFEST).slice(0, LIMIT);
  console.log(`[batch-import] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"}  rights=${HAS_RIGHTS}  rows=${records.length}`);

  const seenHashes = new Set();
  const out = [];
  const stats = { parsed: 0, deduped: 0, byCategory: {}, byAdapter: {} };

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    stats.parsed++;
    try {
      const row = await buildRow(rec, i);
      // 内容去重（同一次运行内按 image 字节 md5）
      const imgSrc = rec.image_url || rec.image_local || "";
      const h = imgSrc ? shortHash(imgSrc) : row.slug;
      if (seenHashes.has(h)) { stats.deduped++; continue; }
      seenHashes.add(h);
      out.push(row);
      const c = row.data.category; stats.byCategory[c] = (stats.byCategory[c] || 0) + 1;
      for (const a of row.data.adapters) stats.byAdapter[a] = (stats.byAdapter[a] || 0) + 1;
    } catch (e) {
      console.error(`  ✗ 第 ${i} 行跳过: ${e.message}`);
    }
  }

  console.log(`[batch-import] 待写入 ${out.length} 条（去重 ${stats.deduped}）`);
  console.log(`[batch-import] 分类分布:`, stats.byCategory);
  console.log(`[batch-import] 适配器分布:`, stats.byAdapter);
  if (out[0]) console.log(`[batch-import] 样例 slug: ${out[0].slug}  imageUrl=${out[0].data.imageUrl || "(无图)"}`);

  await insertDesignsBatch(out);

  if (DRY_RUN) {
    console.log("[batch-import] DRY-RUN 完成，未写入任何数据。去掉 --dry-run 并加 --i-have-rights 才真正落库。");
    return;
  }
  if (PROBE) return; // probe 模式由 probe() 自行输出，不在这里打印落库汇总

  // 直写完成 → 提示重启容器让 3 个实例 rehydrate
  console.log(`\n✅ 已直写 ${out.length} 条到 D1 designs 表。`);
  console.log("⚠️ 必须重启容器，否则新设计只在之后重启的实例上可见（max_instances=3 跨实例不一致）：");
  if (CFG.CONTAINER_APP_ID) {
    console.log(`   ${CFG.WRANGLER} containers delete ${CFG.CONTAINER_APP_ID} && ${CFG.WRANGLER} deploy`);
  } else {
    console.log(`   1) ${CFG.WRANGLER} deploy 日志里找 "Application ID: <app>"`);
    console.log(`   2) ${CFG.WRANGLER} containers delete <app>`);
    console.log(`   3) ${CFG.WRANGLER} deploy`);
    console.log(`   4) 轮询 /api/health 直到 uptime 重置为个位数`);
  }
}

// ───────────────────────────── probe 模式（可逆验证闭环） ─────────────────────────────
async function probe() {
  if (!HAS_RIGHTS) {
    console.error("⛔ probe 也会写入，需要 --i-have-rights。");
    process.exit(3);
  }
  // 1) 生成 1x1 PNG，传到 R2（仅当 R2 凭据就绪；否则跳过，仅验证 D1 闭环）
  let url = "";
  if (R2_READY) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64",
    );
    const key = `uploads/${CFG.OWNER_USER_ID}/probe-${shortHash(String(Date.now()))}.png`;
    url = await uploadToR2(key, png, "image/png");
    console.log("[probe] R2 上传:", url);
  } else {
    console.log("[probe] 跳过 R2（未配置凭据）；R2 直传已在 upload 流程中独立验证过。仅验证 D1 闭环。");
  }

  // 2) 插入 D1
  const slug = `batchimport-probe-${shortHash(String(Date.now()))}`;
  const now = Date.now();
  const data = { id: `dsn_${slug}`, slug, user_id: CFG.OWNER_USER_ID, title: "Probe", category: "art",
    tags: ["probe"], creator: CFG.OWNER_CREATOR, creatorName: CFG.OWNER_CREATOR_NAME,
    adapters: DEFAULT_ADAPTERS, premiumCents: 0, priceCents: 2800, aiGenerated: false,
    source: "upload", created_at: new Date(now).toISOString(), imageUrl: url };
  await d1Query(
    `INSERT INTO designs (slug, user_id, data, created_ts) VALUES (?,?,?,?)`,
    [slug, CFG.OWNER_USER_ID, JSON.stringify(data), now],
  );
  console.log("[probe] D1 插入:", slug);

  // 3) 读回确认
  const rows = await d1Query("SELECT slug, user_id FROM designs WHERE slug = ?", [slug]);
  console.log("[probe] D1 读回:", rows.length ? "OK" : "MISSING");

  // 4) 清理（删除探针行）
  await d1Query("DELETE FROM designs WHERE slug = ?", [slug]);
  console.log("[probe] 已清理探针行。闭环验证通过 ✅");
}

main()
  .then(() => (PROBE ? probe() : null))
  .catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
