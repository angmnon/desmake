// D1 backup script — dumps every table to JSON under backups/<timestamp>/.
//
// Credentials are read from the environment (D1_CF_API_TOKEN, D1_ACCOUNT_ID,
// D1_DATABASE_ID). Run with:  node --env-file=.env scripts/backup_d1.mjs
// Or export them inline. Restores with scripts/restore_d1.mjs <backup-dir>.

import { writeFile, mkdir } from "node:fs/promises";

const ACCOUNT_ID = process.env.D1_ACCOUNT_ID;
const DATABASE_ID = process.env.D1_DATABASE_ID;
const TOKEN = process.env.D1_CF_API_TOKEN;

// R2-Low: no hardcoded account/database ids. They used to be baked in as fallbacks,
// so a run without env vars would silently back up (or read from) whichever account
// the repo happened to name — wrong-tenant risk. Require them explicitly.
const missing = [
  !TOKEN && "D1_CF_API_TOKEN",
  !ACCOUNT_ID && "D1_ACCOUNT_ID",
  !DATABASE_ID && "D1_DATABASE_ID",
].filter(Boolean);
if (missing.length) {
  console.error(`Missing required env: ${missing.join(", ")} (export them or use --env-file=.env)`);
  process.exit(1);
}

// Tables to back up. Missing tables are tolerated (a fresh DB may not have them yet).
const TABLES = [
  "users",
  "sessions",
  "orders",
  "designs",
  "generation_jobs",
  "email_verifications",
  "creator_earnings",
  "referral_earnings",
  "design_events",
  "cms_posts",
  "catalog_meta",
  "settle_audit",
  "consent_log",
];

async function query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await res.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors || body));
  return body.result?.[0]?.results ?? [];
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = `backups/${stamp}`;
await mkdir(outDir, { recursive: true });

const manifest = { stamp, account: ACCOUNT_ID, database: DATABASE_ID, tables: {} };
for (const t of TABLES) {
  try {
    const rows = await query(`SELECT * FROM ${t}`);
    await writeFile(`${outDir}/${t}.json`, JSON.stringify(rows, null, 2));
    manifest.tables[t] = rows.length;
    console.log(`✓ ${t}: ${rows.length} rows`);
  } catch (e) {
    console.warn(`✗ ${t}: ${e.message}`);
    manifest.tables[t] = `error: ${e.message}`;
  }
}
await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nBackup complete → ${outDir}`);
