// Post-deploy probe: confirm the D1-authoritative fix is live (grid + detail show
// image_url for backfilled designs). Handles instance-rollout delay by retrying.
const SITE = "https://desmake.com";

async function probe() {
  const health = await (await fetch(`${SITE}/api/health`)).json();
  const grid = await (await fetch(`${SITE}/api/listings?q=matcha`)).json();
  const gImg = grid.items?.[0]?.image_url || "";
  const detail = await (await fetch(`${SITE}/api/listings/matcha-buddy`)).json();
  const dImg = detail.data?.image_url || "";
  const dNeb = (await (await fetch(`${SITE}/api/listings/nebula-orb`)).json()).data?.image_url || "";
  return { uptime: health.uptime_seconds, gImg, dImg, dNeb };
}

async function main() {
  for (let i = 1; i <= 10; i++) {
    const p = await probe();
    const ok = p.gImg.startsWith("/cdn/") && p.dImg.startsWith("/cdn/") && p.dNeb.startsWith("/cdn/");
    console.log(
      `try ${i}: uptime=${p.uptime}s  grid=${p.gImg.slice(0, 45) || "(none)"}  detail=${p.dImg.slice(0, 45) || "(none)"}  nebula=${p.dNeb.slice(0, 45) || "(none)"}`,
    );
    if (ok) { console.log("FIX LIVE ✔"); return; }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("still not live after 10 tries");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
