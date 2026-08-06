// D1 restore script — re-inserts rows from a backup produced by backup_d1.mjs.
//
// Usage:  node --env-file=.env scripts/restore_d1.mjs backups/<timestamp>
// Uses INSERT OR REPLACE so it is safe to re-run. Restores the whole dataset;
// review before running against a production database.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "ceb1001d1ab2a3f36b40aa34ca3b6db5";
const DATABASE_ID = process.env.D1_DATABASE_ID || "39a994b2-f353-4ee3-a1ff-6288963a1339";
const TOKEN = process.env.D1_CF_API_TOKEN;

const dir = process.argv[2];
if (!dir || !existsSync(`${dir}/manifest.json`)) {
  console.error("Usage: node scripts/restore_d1.mjs <backup-dir>");
  process.exit(1);
}
if (!TOKEN) {
  console.error("D1_CF_API_TOKEN is required");
  process.exit(1);
}

async function exec(sql, params = []) {
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
  return body;
}

const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, "utf8"));
for (const [t, count] of Object.entries(manifest.tables)) {
  if (typeof count !== "number") {
    console.warn(`- skip ${t} (${count})`);
    continue;
  }
  const rows = JSON.parse(await readFile(`${dir}/${t}.json`, "utf8"));
  if (rows.length === 0) {
    console.log(`- ${t}: empty, skipped`);
    continue;
  }
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => "?").join(",");
  const sql = `INSERT OR REPLACE INTO ${t} (${cols.join(",")}) VALUES (${placeholders})`;
  for (const r of rows) {
    await exec(sql, cols.map((c) => r[c]));
  }
  console.log(`✓ restored ${t}: ${rows.length} rows`);
}
console.log("\nRestore complete.");
