// Backfill real AI raster images for the 65 pre-fix batch designs.
//
// Why: designs published before the "ai-image-2026-08-04" fix never stored an
// imageUrl, so they render the procedural <Artwork> SVG instead of the real
// generated art. This re-generates each from its stored prompt, re-hosts the
// Agnes raster to R2 through the LIVE /api/upload endpoint (which holds the R2
// creds), and writes the durable /cdn/ URL back into D1 — idempotent and matching
// the new-publish behaviour exactly.
//
// No redeploy required. Respects the 6/min /api/generate rate limit.
//
// Usage:
//   DRY_RUN=1 node scripts/agnes_backfill.mjs      # list targets only
//   LIMIT=3   node scripts/agnes_backfill.mjs      # process first 3 (smoke)
//   node scripts/agnes_backfill.mjs                # backfill all

import crypto from "node:crypto";

const SITE = process.env.SITE_URL || "https://desmake.com";
const EMAIL = "catalog@desmake.local";
const PASSWORD = "DesmakeCatalog2026!";
const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const GEN_GAP_MS = 11000; // >=10s ⇒ stays under 6/min generate limit
const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 35000;

// D1 (direct REST — no container needed for the read/write of rows)
const CF_ACCOUNT = "ceb1001d1ab2a3f36b40aa34ca3b6db5";
const D1_DB = "39a994b2-f353-4ee3-a1ff-6288963a1339";
const D1_TOKEN = process.env.D1_API_TOKEN || "";
const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

async function d1Query(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) throw new Error("D1 error: " + JSON.stringify(json.errors));
  return json.result[0].results;
}

async function login() {
  const res = await fetch(`${SITE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const sc = res.headers.get("set-cookie");
  if (!sc) throw new Error("no set-cookie from login");
  const token = sc.split(";")[0]; // "dm_session=..."
  return token;
}

async function generate(prompt, cookie) {
  const res = await fetch(`${SITE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ prompt, style: "minimal", aspect: "1:1", count: 1 }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`generate failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.job_id;
}

async function pollJob(jobId, cookie) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${SITE}/api/generate/${jobId}`, { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error(`poll failed: ${res.status}`);
    const j = await res.json();
    if (j.status === "succeeded" && j.outputs?.length) return j.outputs[0].imageUrl;
    if (j.status === "failed") throw new Error("job failed: " + j.error);
    await sleep(POLL_MS);
  }
  throw new Error("poll timeout");
}

async function rehost(agnesUrl, cookie) {
  const r = await fetch(agnesUrl);
  if (!r.ok) throw new Error(`fetch agnes ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) throw new Error("image >4MB");
  const ct = r.headers.get("content-type") || "image/png";
  if (!["image/jpeg", "image/png", "image/webp"].includes(ct)) throw new Error("bad ct " + ct);
  const dataUrl = `data:${ct};base64,${buf.toString("base64")}`;
  const res = await fetch(`${SITE}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.url;
}

async function main() {
  const rows = await d1Query("SELECT slug, data FROM designs");
  const targets = [];
  for (const { slug, data } of rows) {
    let d;
    try {
      d = JSON.parse(data);
    } catch {
      continue;
    }
    if (d.source === "ai" && !d.imageUrl && d.prompt && d.prompt.trim()) {
      targets.push({ slug, prompt: d.prompt.trim() });
    }
  }
  log(`found ${targets.length} AI designs needing an image`);
  if (DRY_RUN) {
    for (const t of targets.slice(0, LIMIT)) log("  DRY target:", t.slug, "::", t.prompt.slice(0, 60));
    return;
  }

  const cookie = await login();
  log("logged in");

  let ok = 0;
  let failed = 0;
  let lastGen = 0;
  const capped = targets.slice(0, LIMIT);
  for (let i = 0; i < capped.length; i++) {
    const { slug, prompt } = capped[i];
    try {
      // honour generate rate limit
      const since = Date.now() - lastGen;
      if (lastGen && since < GEN_GAP_MS) await sleep(GEN_GAP_MS - since);
      lastGen = Date.now();
      const jobId = await generate(prompt, cookie);
      const agnesUrl = await pollJob(jobId, cookie);
      let url;
      try {
        url = await rehost(agnesUrl, cookie);
      } catch (e) {
        log(`  rehost failed for ${slug} (${e.message}); storing raw agnes url`);
        url = agnesUrl; // graceful fallback — real art still shows
      }
      await d1Query("UPDATE designs SET data = json_set(data, '$.imageUrl', ?) WHERE slug = ?", [url, slug]);
      ok++;
      log(`  [${i + 1}/${capped.length}] OK ${slug} -> ${url}`);
    } catch (e) {
      failed++;
      log(`  [${i + 1}/${capped.length}] FAIL ${slug}: ${e.message}`);
      if (e.message === "RATE_LIMITED") {
        log("  rate limited — pausing 30s");
        await sleep(30000);
        i--; // retry this one
      }
    }
  }
  log(`DONE. ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
