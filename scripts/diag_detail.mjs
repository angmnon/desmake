// Diagnose: is the detail endpoint's missing image_url caused by stale per-instance
// memory (detail reads memory-only via findListingBySlug, backfill wrote D1 directly)?
const CF_ACCOUNT = "ceb1001d1ab2a3f36b40aa34ca3b6db5";
const D1_DB = "39a994b2-f353-4ee3-a1ff-6288963a1339";
const D1_TOKEN = process.env.D1_API_TOKEN || "";
const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`;
const SITE = "https://desmake.com";

async function main() {
  const res = await fetch(D1_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${D1_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: "SELECT json_extract(data,'$.imageUrl') AS u FROM designs WHERE slug='matcha-buddy'" }),
  });
  const j = await res.json();
  console.log("D1 matcha-buddy imageUrl:", j.result[0].results[0]?.u ?? "NULL");

  let has = 0, miss = 0;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${SITE}/api/listings/matcha-buddy`);
    const d = await r.json();
    if (d.data?.image_url) { has++; console.log(`hit ${i + 1}: HAS image_url`); }
    else { miss++; console.log(`hit ${i + 1}: MISSING (status ${r.status})`); }
  }
  console.log(`detail: has=${has} missing=${miss} (8 hits)`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
