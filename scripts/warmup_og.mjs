// Warm up the dynamic OG share-card route after a deploy.
//
// For each live /listing/<slug>, GET /og/listing/<slug> once. The first request
// per unique design state renders the card (Satori + Images transcode) and, since
// Phase 2, persists it to R2 — so subsequent requests (including social crawlers)
// are served instantly from the cache with no per-request CPU. This also primes the
// edge cache so the very first share-preview is fast.
//
// Best-effort: failures are counted and reported but do NOT fail the deploy.
//
// Env:
//   SITE_URL          base URL (default https://desmake.com)
//   OG_WARMUP_LIMIT  max number of listings to warm (default 200)
//   OG_WARMUP_CONCURRENCY  parallel requests (default 8)

const SITE_URL = (process.env.SITE_URL || "https://desmake.com").replace(/\/$/, "");
const LIMIT = parseInt(process.env.OG_WARMUP_LIMIT || "200", 10);
const CONCURRENCY = parseInt(process.env.OG_WARMUP_CONCURRENCY || "8", 10);

// The site WAF requires a browser User-Agent (1010 challenge otherwise).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 30000;

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" },
      signal: ctrl.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

// Collect <loc> URLs from a sitemap document.
function locsFromXml(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

async function collectListingSlugs() {
  const slugs = new Set();
  const seenSitemaps = new Set();
  const queue = [`${SITE_URL}/sitemap.xml`];

  while (queue.length) {
    const url = queue.shift();
    if (seenSitemaps.has(url)) continue;
    seenSitemaps.add(url);
    let xml;
    try {
      const r = await fetchText(url);
      if (!r.ok) {
        console.warn(`  ! sitemap ${url} -> HTTP ${r.status}`);
        continue;
      }
      xml = r.text;
    } catch (e) {
      console.warn(`  ! sitemap ${url} -> ${e.message}`);
      continue;
    }
    // Sitemap index? push sub-sitemaps; else extract listing slugs.
    if (/<sitemap>/i.test(xml)) {
      for (const loc of locsFromXml(xml)) {
        if (loc.endsWith(".xml") && !seenSitemaps.has(loc)) queue.push(loc);
      }
    } else {
      for (const loc of locsFromXml(xml)) {
        const m = loc.match(/\/listing\/([^/?#]+)/);
        if (m) slugs.add(decodeURIComponent(m[1]));
      }
    }
  }
  return [...slugs];
}

async function warmOne(slug) {
  const url = `${SITE_URL}/og/listing/${encodeURIComponent(slug)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "image/*" },
      signal: ctrl.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, bytes: buf.length };
  } catch (e) {
    return { ok: false, status: 0, bytes: 0, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  console.log(`[warmup-og] site=${SITE_URL} limit=${LIMIT} concurrency=${CONCURRENCY}`);
  const slugs = await collectListingSlugs();
  console.log(`[warmup-og] discovered ${slugs.length} listing slugs`);
  const targets = slugs.slice(0, LIMIT);
  console.log(`[warmup-og] warming ${targets.length} OG cards...`);

  let ok = 0;
  let failed = 0;
  let bytes = 0;
  let tooBig = 0;
  const errors = [];

  // Simple bounded-concurrency pool.
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((s) => warmOne(s)));
    for (const r of results) {
      if (r.ok && r.status === 200) {
        ok++;
        bytes += r.bytes;
        if (r.bytes > 300 * 1024) tooBig++;
      } else {
        failed++;
        if (errors.length < 10) {
          errors.push(`slug batch around ${targets[i]} -> ${r.status || r.error}`);
        }
      }
    }
    process.stdout.write(`\r[warmup-og] ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length} processed`);
  }
  process.stdout.write("\n");

  const avg = ok ? Math.round(bytes / ok) : 0;
  console.log(`[warmup-og] done. ok=${ok} failed=${failed} avgBytes=${avg} over300KB=${tooBig}`);
  if (errors.length) {
    console.log("[warmup-og] sample errors:");
    for (const e of errors) console.log("   - " + e);
  }
  // Best-effort: never fail the deploy pipeline.
  process.exit(0);
}

run().catch((e) => {
  console.error("[warmup-og] fatal:", e);
  process.exit(0);
});
