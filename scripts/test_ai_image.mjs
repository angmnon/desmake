// scripts/test_ai_image.mjs
// End-to-end check that AI designs now persist + re-host the real raster (R2 /cdn).
import fs from "node:fs";

const BASE = process.env.DEMAKE_BASE || "https://desmake.com";
const EMAIL = "catalog@desmake.local";
const PASSWORD = "DesmakeCatalog2026!";

let COOKIE = "";
async function req(method, p, body) {
  const headers = { "Content-Type": "application/json" };
  if (COOKIE) headers["Cookie"] = COOKIE;
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get("set-cookie");
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, setCookie: sc, data };
}
async function ensureCookie() {
  await req("POST", "/api/auth/register", { email: EMAIL, name: "Desmake Catalog", password: PASSWORD });
  const login = await req("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  const m = login.setCookie?.match(/dm_session=([^;,\s]+)/);
  if (!m) throw new Error("no session");
  COOKIE = "dm_session=" + m[1];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TITLE = "Test R2 Hero " + Date.now().toString(36);
const PROMPT = "Bold risograph poster, a smiling sun and waving mountain, warm coral and teal, playful flat vector";

async function main() {
  await ensureCookie();
  // 1) generate
  const g = await req("POST", "/api/generate", { prompt: PROMPT, aspect: "1:1", count: 1, style: "minimal" });
  if (g.status !== 202) throw new Error("generate failed " + g.status);
  const jobId = g.data.job_id;
  let out = null;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const poll = await req("GET", "/api/generate/" + jobId);
    if (poll.data?.status === "succeeded") { out = poll.data.outputs?.[0]; break; }
    if (poll.data?.status === "failed") throw new Error("job failed " + poll.data.error);
  }
  if (!out) throw new Error("poll timeout");
  console.log("generate imageUrl (raw):", (out.imageUrl || "").slice(0, 80), "...");

  // 2) publish with the AI raster
  const pub = await req("POST", "/api/designs", {
    source: "ai",
    seed: out.seed,
    palette: ["#ff6b4a", "#1fb6a6", "#0c0c0d"],
    shape: 4,
    imageUrl: out.imageUrl,
    title: TITLE,
    category: "poster",
    adapters: ["poster", "tshirt", "sticker"],
    prompt: PROMPT,
    tags: ["risograph", "sun", "test"],
    description: "E2E test of AI image persistence + R2 rehost.",
  });
  if (pub.status !== 201) throw new Error("publish failed " + pub.status + " " + JSON.stringify(pub.data));
  const slug = pub.data.slug;
  console.log("published slug:", slug);

  // 3) read it back via listings detail + grid
  await sleep(1500);
  const detail = await req("GET", "/api/listings/" + slug);
  const dImg = detail.data?.data?.image_url;
  console.log("detail image_url:", dImg);
  const gridQ = await req("GET", "/api/listings?q=" + encodeURIComponent(TITLE));
  const gItem = gridQ.data?.items?.find((x) => x.slug === slug);
  console.log("grid image_url:", gItem?.image_url);

  const ok = typeof dImg === "string" && dImg.startsWith("/cdn/");
  console.log("\nRESULT:", ok ? "PASS — AI raster re-hosted to R2 and visible" : "FAIL — image_url not a /cdn/ URL");
  console.log("CLEANUP slug:", slug);
  fs.writeFileSync("/tmp/test_ai_slug.txt", slug);
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
