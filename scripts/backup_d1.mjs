// D1 backup script — dumps every table to JSON under backups/<timestamp>/.
//
// Credentials are read from the environment (D1_CF_API_TOKEN, D1_ACCOUNT_ID,
// D1_DATABASE_ID). Run with:  node --env-file=.env scripts/backup_d1.mjs
// Or export them inline. Restores with scripts/restore_d1.mjs <backup-dir>.

import { writeFile, mkdir } from "node:fs/promises";

const ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5";
const DATABASE_ID = process.env.D1_DATABASE_ID || "39a994b2-f353-4ee3-a1ff-6288963a1339";
const TOKEN = process.env.D1_CF_API_TOKEN;

if (!TOKEN) {
  console.error("D1_CF_API_TOKEN is required (export it or use --env-file=.env)");
  process.exit(1);
}

// Tables to back up. `email_verifications` may not exist until the server has
// booted once after the schema change — the script tolerates a missing table.
const TABLES = ["users", "sessions", "orders", "designs", "generation_jobs", "email_verifications"];

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
