/**
 * Desmake end-to-end acceptance test.
 *
 * This exists because two rounds of static code audit both concluded the system
 * was broken without ever compiling or running it. Every assertion here is a
 * regression guard for a specific finding in 7xai-code-audit-report-R2.md.
 *
 * Usage:
 *   1. pnpm build            # or: next build && tsup src/server.ts ...
 *   2. PORT=5199 node dist/server.js
 *   3. node scripts/e2e.mjs  # BASE=http://localhost:5199 by default
 *
 * Exits 0 when every check passes, 1 otherwise.
 */
const BASE = process.env.BASE || "http://localhost:5199";

let cookie = "";
const jar = new Map();

function absorb(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
  });
  absorb(res);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const money = (c) => (typeof c === "number" ? `$${(c / 100).toFixed(2)}` : String(c));
let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : `   (expected ${expected})`}`);
}

const SHIP = { line1: "1 Test St", city: "Portland", region: "OR", postal: "97201", country: "US" };
const CUST = { name: "E2E Buyer", email: "e2e@desmake.test" };

const run = async () => {
  console.log("=".repeat(70));
  console.log("DESMAKE E2E — price integrity across the whole purchase funnel");
  console.log("=".repeat(70));

  // ---- 0. adapters catalog -------------------------------------------------
  const ad = await api("/api/adapters");
  const adapters = ad.body.adapters;
  const A3D = adapters.find((a) => a.id === "print3d");
  console.log(`\n[0] adapters: ${adapters.length} | 3D Print id="${A3D.id}" retail=${money(A3D.retail_cents)}`);

  // ---- 1. writes require a session (R1/C6, R2/H9) -------------------------
  console.log("\n[1] auth guard on writes");
  const anon = await api("/api/orders", { method: "POST", body: JSON.stringify({ items: [] }) });
  check("POST /api/orders while signed out -> 401", anon.status, 401);
  const anonGen = await api("/api/generate", { method: "POST", body: JSON.stringify({ prompt: "x" }) });
  check("POST /api/generate while signed out -> 401", anonGen.status, 401);

  // ---- 2. sign in ----------------------------------------------------------
  console.log("\n[2] sign in");
  const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify(CUST) });
  check("POST /api/auth/login -> 200", login.status, 200);
  const sess = await api("/api/auth/session");
  check("GET /api/auth/session -> 200", sess.status, 200);

  // ---- 3. listing detail: the price the UI shows (R2/C4) ------------------
  const listRes = await api("/api/listings");
  const listings = listRes.body.listings || listRes.body.items || listRes.body.data;
  const target = listings.find((d) => (d.adapters || []).includes("print3d"));
  const detail = (await api(`/api/listings/${target.slug}`)).body.data;
  const a3d = detail.adapters.find((a) => a.id === "print3d");
  const v0 = a3d.variants[0];
  const vDelta = a3d.variants.find((v) => v.price_delta > 0);

  console.log(`\n[3] listing "${detail.title}" (${target.slug})`);
  console.log(`        3D Print variants: ${a3d.variants.map((v) => `${v.id}=${money(v.price_cents)}`).join("  ")}`);
  check("base variant price == $68.00", v0.price_cents, 6800);
  check("adapter retail == base variant", a3d.retail_cents, v0.price_cents);

  // ---- 4. place the order (server is the pricing authority) ---------------
  console.log("\n[4] POST /api/orders  (1 x base variant)");
  const order = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: detail.id, adapter: "print3d", variant: v0.id, quantity: 1 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  check("status -> 201 Created", order.status, 201);
  if (order.status !== 201) {
    console.log("        body:", JSON.stringify(order.body).slice(0, 500));
    process.exit(1);
  }
  const oid = order.body.order_id;
  console.log(`        order_id=${oid}  total=${money(order.body.total)}`);

  // ---- 5. order detail must echo identical numbers ------------------------
  console.log(`\n[5] GET /api/orders/:id — the number the buyer finally sees`);
  const got = await api(`/api/orders/${oid}`);
  check("status", got.status, 200);
  const p = got.body.pricing;
  console.log(`        subtotal=${money(p.subtotal_cents)}  ship=${money(p.shipping_cents)}  tax=${money(p.tax_cents)}  total=${money(p.total_cents)}`);
  check("unit price == listing price ($68.00)", got.body.items[0].unit_price_cents, 6800);
  check("subtotal == unit x qty", p.subtotal_cents, 6800);
  check("total == subtotal + ship + tax", p.total_cents, p.subtotal_cents + p.shipping_cents + p.tax_cents);
  check("POST total == detail total", order.body.total, p.total_cents);
  check("adapter id preserved, not a display name (C4)", got.body.items[0].adapter, "print3d");
  console.log(`        manufacturing.status = ${got.body.manufacturing?.status}`);

  // ---- 6. variant delta must actually apply (R2/M4, M5) -------------------
  console.log(`\n[6] variant surcharge — "${vDelta.id}" (+${money(vDelta.price_delta)})`);
  const o2 = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: detail.id, adapter: "print3d", variant: vDelta.id, quantity: 2 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  const o2d = (await api(`/api/orders/${o2.body.order_id}`)).body;
  check("unit price includes delta", o2d.items?.[0]?.unit_price_cents, 6800 + vDelta.price_delta);
  check("subtotal == unit x 2", o2d.pricing?.subtotal_cents, (6800 + vDelta.price_delta) * 2);

  // ---- 7. tampering / invalid input (R2/H3) -------------------------------
  console.log("\n[7] server-authoritative pricing & validation");
  const tamper = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: detail.id, adapter: "print3d", variant: v0.id, quantity: 1, unit_price_cents: 1, price_cents: 1 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  const tb = (await api(`/api/orders/${tamper.body.order_id}`)).body;
  check("client-supplied price ignored", tb.items?.[0]?.unit_price_cents, 6800);
  const wrongAdapter = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: detail.id, adapter: "tshirt", variant: "M", quantity: 1 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  check("adapter not offered by listing -> 400 (H3)", wrongAdapter.status, 400);
  const badVariant = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: detail.id, adapter: "print3d", variant: "Unobtanium", quantity: 1 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  check("unknown variant -> 400", badVariant.status, 400);

  // ---- 8. IDOR (R2/H1) ----------------------------------------------------
  console.log("\n[8] IDOR (H1)");
  jar.clear(); cookie = "";
  await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "mallory@desmake.test", name: "Mallory" }) });
  const steal = await api(`/api/orders/${oid}`);
  check("another signed-in user reading the order -> 404", steal.status, 404);

  // ---- 9. unknown ids are 404, never synthesized (R1/H6) ------------------
  console.log("\n[9] unknown ids are not fabricated");
  check("GET /api/orders/<bogus> -> 404", (await api("/api/orders/ord_nope")).status, 404);
  check("GET /api/listings/<bogus> -> 404", (await api("/api/listings/not-a-real-slug")).status, 404);
  check("GET /api/creators/<bogus> -> 404", (await api("/api/creators/nobody")).status, 404);

  // ---- 10. generate -> publish -> buy (R2/H8 death loop, M13) -------------
  console.log("\n[10] studio loop: generate -> publish -> listing -> buy (H8)");
  const gen = await api("/api/generate", {
    method: "POST",
    body: JSON.stringify({ prompt: "e2e test object", style: "minimal", aspect: "16:9", count: 2 }),
  });
  check("POST /api/generate -> 202 Accepted", gen.status, 202);
  const jobId = gen.body.job_id;
  let job = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 300));
    job = (await api(`/api/generate/${jobId}`)).body;
    if (job.status === "succeeded" || job.status === "failed") break;
  }
  check("job reaches succeeded", job?.status, "succeeded");
  const out = job?.outputs?.[0];
  check("output width follows 16:9 aspect (M13)", out?.width, 1360);

  const pub = await api("/api/designs", {
    method: "POST",
    body: JSON.stringify({
      title: "E2E Published Object",
      seed: out.seed, palette: out.palette, shape: out.shape,
      category: "3d", adapters: ["print3d"],
    }),
  });
  check("POST /api/designs -> 201 Created", pub.status, 201);
  const pubDetail = await api(`/api/listings/${pub.body.slug}`);
  check("published design is browsable", pubDetail.status, 200);
  const buy = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ listing_id: pub.body.id, adapter: "print3d", variant: v0.id, quantity: 1 }],
      customer: CUST, shipping: SHIP,
    }),
  });
  check("published design is buyable -> 201", buy.status, 201);

  console.log("\n" + "=".repeat(70));
  console.log(failures === 0 ? "ALL CHECKS PASSED — 3D Print is $68.00 at every hop" : `${failures} CHECK(S) FAILED`);
  console.log("=".repeat(70));
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => { console.error("E2E CRASHED:", e); process.exit(1); });
