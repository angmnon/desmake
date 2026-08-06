// Live verification of the Desmake marketplace after the AI-image backfill.
// Checks D1 counts, listing/detail API responses, and spot-checks real /cdn/ images.
const CF_ACCOUNT = "ceb1001d1ab2a3f36b40aa34ca3b6db5";
const D1_DB = "39a994b2-f353-4ee3-a1ff-6288963a1339";
const D1_TOKEN = process.env.D1_API_TOKEN || "";
const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`;
const SITE = "https://desmake.com";

async function d1Query(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${D1_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const j = await res.json();
  if (!j.success) throw new Error("D1: " + JSON.stringify(j.errors));
  return j.result[0].results;
}

async function main() {
  const total = await d1Query("SELECT COUNT(*) AS c FROM designs");
  const aiWithImg = await d1Query(
    "SELECT COUNT(*) AS c FROM designs WHERE json_extract(data,'$.source')='ai' AND json_extract(data,'$.imageUrl') IS NOT NULL",
  );
  const aiNoImg = await d1Query(
    "SELECT COUNT(*) AS c FROM designs WHERE json_extract(data,'$.source')='ai' AND json_extract(data,'$.imageUrl') IS NULL",
  );
  const uploads = await d1Query(
    "SELECT COUNT(*) AS c FROM designs WHERE json_extract(data,'$.source')='upload'",
  );
  console.log(`D1 designs: total=${total[0].c}  ai_with_image=${aiWithImg[0].c}  ai_without_image=${aiNoImg[0].c}  uploads=${uploads[0].c}`);

  const health = await (await fetch(`${SITE}/api/health`)).json();
  console.log(`health: ${health.status} uptime=${health.uptime_seconds}s errors_last_hour=${health.errors_last_hour}`);

  const list = await (await fetch(`${SITE}/api/listings?page=1`)).json();
  console.log(`listings: total=${list.total} pages=${list.total_pages}`);

  for (const slug of ["matcha-buddy", "nebula-orb", "grid-confetti", "monstera-line", "soft-machine"]) {
    const d = await (await fetch(`${SITE}/api/listings/${slug}`)).json();
    const img = d.data?.image_url ?? d.image_url ?? "MISSING";
    console.log(`detail ${slug}: image_url=${String(img).slice(0, 90)}`);
  }

  const samples = await d1Query(
    "SELECT slug, json_extract(data,'$.imageUrl') AS u FROM designs WHERE json_extract(data,'$.source')='ai' LIMIT 6",
  );
  for (const s of samples) {
    if (!s.u) { console.log(`cdn ${s.slug}: NO IMAGE`); continue; }
    const r = await fetch(SITE + s.u);
    const b = Buffer.from(await r.arrayBuffer());
    console.log(`cdn ${s.slug}: HTTP ${r.status} bytes=${b.length}`);
  }
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
