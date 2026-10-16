/* ============================================================
   DESMAKE — Shared prototype data layer
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Product Adapters (Phase 1) ---------- */
  const ADAPTERS = [
    { id: "tshirt", name: "T-Shirt", mockup: "tshirt", method: "DTG / DTF", lead: "3–5", costCents: 1180, retailCents: 3200, icon: "shirt" },
    { id: "poster", name: "Poster", mockup: "poster", method: "Giclée Print", lead: "2–4", costCents: 940, retailCents: 2800, icon: "frame" },
    { id: "card", name: "Business Card", mockup: "card", method: "Digital Offset", lead: "3–6", costCents: 1600, retailCents: 4200, icon: "card" },
    { id: "phonecase", name: "Phone Case", mockup: "phonecase", method: "UV Printing", lead: "3–5", costCents: 1040, retailCents: 2900, icon: "phone" },
    { id: "sticker", name: "Sticker Pack", mockup: "sticker", method: "Die Cut", lead: "2–3", costCents: 380, retailCents: 1200, icon: "sticker" },
    { id: "print3d", name: "3D Print", mockup: "print3d", method: "FDM / SLA", lead: "5–9", costCents: 2650, retailCents: 6800, icon: "cube" }
  ];
  const adapterById = (id) => ADAPTERS.find((a) => a.id === id) || ADAPTERS[0];

  /* ---------- Creators ---------- */
  const CREATORS = [
    { handle: "kaisu", name: "Kai Sugimoto", city: "Kyoto, JP", role: "3D Designer · AI Creator", verified: true, followers: 24800, sales: 3120, works: 48, rating: 4.9, bio: "Generative forms and quiet geometry. Building objects that feel inevitable." },
    { handle: "lenaost", name: "Lena Østergaard", city: "Copenhagen, DK", role: "Graphic Designer", verified: true, followers: 18240, sales: 2410, works: 62, rating: 4.8, bio: "Swiss grids, Nordic light. Type-led compositions for print." },
    { handle: "marcotv", name: "Marco Tavares", city: "Lisbon, PT", role: "Illustrator", verified: false, followers: 9120, sales: 880, works: 31, rating: 4.7, bio: "Hand-drawn chaos, digitally tamed." },
    { handle: "amaraok", name: "Amara Okafor", city: "Lagos, NG", role: "AI Creator", verified: true, followers: 31600, sales: 4870, works: 74, rating: 4.9, bio: "Afro-futurist pattern systems. Prompted, curated, refined." },
    { handle: "yuwen", name: "Yu Wen", city: "Shanghai, CN", role: "Artist · Printmaker", verified: true, followers: 15380, sales: 1960, works: 40, rating: 4.8, bio: "Ink, risograph, and the space between." },
    { handle: "noahb", name: "Noah Brandt", city: "Berlin, DE", role: "Type Designer", verified: false, followers: 7640, sales: 610, works: 22, rating: 4.6, bio: "Letterforms as architecture." },
    { handle: "sofiar", name: "Sofia Ruiz", city: "Mexico City, MX", role: "Illustrator · Muralist", verified: true, followers: 21050, sales: 2740, works: 55, rating: 4.9, bio: "Colour first, always." },
    { handle: "elifk", name: "Elif Kaya", city: "Istanbul, TR", role: "3D Designer", verified: false, followers: 11470, sales: 1290, works: 28, rating: 4.7, bio: "Parametric objects for the home." }
  ];
  const creatorByHandle = (h) => CREATORS.find((c) => c.handle === h) || CREATORS[0];

  /* ---------- Categories ---------- */
  const CATEGORIES = [
    { id: "abstract", name: "Abstract", count: 4820 },
    { id: "typography", name: "Typography", count: 3140 },
    { id: "geometric", name: "Geometric", count: 2760 },
    { id: "illustration", name: "Illustration", count: 5210 },
    { id: "minimal", name: "Minimal", count: 3890 },
    { id: "retro", name: "Retro", count: 1930 },
    { id: "botanical", name: "Botanical", count: 1480 },
    { id: "3d", name: "3D & Objects", count: 990 }
  ];

  /* ---------- Designs ---------- */
  const RAW = [
    ["Signal Decay", "kaisu", "abstract", ["poster", "tshirt", "sticker"]],
    ["Meridian 04", "lenaost", "geometric", ["poster", "card"]],
    ["Soft Machine", "amaraok", "abstract", ["tshirt", "poster", "phonecase"]],
    ["Terrazzo Sunday", "sofiar", "illustration", ["sticker", "phonecase", "poster"]],
    ["Kinetic Grid", "noahb", "typography", ["poster", "tshirt"]],
    ["Nocturne", "yuwen", "minimal", ["poster", "card", "tshirt"]],
    ["Lagos Bloom", "amaraok", "illustration", ["tshirt", "poster", "sticker"]],
    ["Vessel Study 12", "elifk", "3d", ["print3d", "poster"]],
    ["Halftone Weather", "marcotv", "retro", ["poster", "sticker"]],
    ["Copenhagen Blue", "lenaost", "minimal", ["poster", "card"]],
    ["Ember Field", "kaisu", "abstract", ["tshirt", "poster"]],
    ["Type as Object", "noahb", "typography", ["poster", "card", "sticker"]],
    ["Sunday Terrace", "sofiar", "illustration", ["poster", "phonecase"]],
    ["Inkfall", "yuwen", "abstract", ["poster", "tshirt", "sticker"]],
    ["Orbital Drift", "kaisu", "geometric", ["poster", "phonecase", "print3d"]],
    ["Paper Cut No.7", "marcotv", "minimal", ["card", "poster"]],
    ["Prism Ritual", "amaraok", "abstract", ["tshirt", "sticker", "poster"]],
    ["Static Garden", "sofiar", "botanical", ["poster", "tshirt"]],
    ["Form Follows", "elifk", "3d", ["print3d", "poster", "card"]],
    ["Long Wave", "lenaost", "geometric", ["poster", "phonecase"]],
    ["Analog Ghost", "marcotv", "retro", ["tshirt", "sticker"]],
    ["Kanji Fragment", "yuwen", "typography", ["poster", "tshirt", "card"]],
    ["Deep Field", "kaisu", "abstract", ["poster", "phonecase"]],
    ["Bauhaus Sunday", "noahb", "geometric", ["poster", "sticker", "tshirt"]],
    ["Salt Flats", "lenaost", "minimal", ["poster", "card"]],
    ["Neon Verse", "amaraok", "abstract", ["tshirt", "phonecase"]],
    ["Cactus Grammar", "sofiar", "botanical", ["poster", "sticker"]],
    ["Modular Vase", "elifk", "3d", ["print3d"]],
    ["Contour Map 09", "kaisu", "minimal", ["poster", "card", "tshirt"]],
    ["Riso Dream", "marcotv", "retro", ["poster", "sticker", "phonecase"]],
    ["Grid Interrupted", "noahb", "typography", ["poster", "tshirt"]],
    ["Blue Hour", "yuwen", "minimal", ["poster", "phonecase", "card"]]
  ];

  const TAGPOOL = ["ai-generated", "print-ready", "vector", "editorial", "poster-art", "monochrome", "colorful", "gradient", "hand-drawn", "risograph", "swiss", "brutalist", "organic", "pattern"];

  const DESIGNS = RAW.map((row, i) => {
    const r = Art.rng("design-" + row[0]);
    const adapters = row[3];
    const base = adapterById(adapters[0]).retailCents;
    const price = base + Math.floor(r() * 14) * 100;
    return {
      id: "dsg_" + String(1042 + i),
      slug: row[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      seed: row[0],
      title: row[0],
      creator: row[1],
      category: row[2],
      adapters: adapters,
      priceCents: price,
      likes: 60 + Math.floor(r() * 3200),
      views: 900 + Math.floor(r() * 48000),
      sales: 4 + Math.floor(r() * 420),
      rating: (4.3 + r() * 0.7).toFixed(1),
      reviews: 3 + Math.floor(r() * 180),
      aiGenerated: r() > 0.45,
      new: i % 7 === 3,
      tags: [TAGPOOL[i % TAGPOOL.length], TAGPOOL[(i * 3 + 5) % TAGPOOL.length], row[2]],
      created: ["2 hours", "6 hours", "1 day", "2 days", "4 days", "1 week", "2 weeks", "3 weeks"][i % 8] + " ago"
    };
  });

  const designById = (id) => DESIGNS.find((d) => d.id === id) || DESIGNS[0];
  const byCreator = (h) => DESIGNS.filter((d) => d.creator === h);

  /* ---------- Orders ---------- */
  const ORDER_STATES = [
    { id: "paid", label: "Paid", tone: "moss" },
    { id: "in_production", label: "In production", tone: "amber" },
    { id: "quality_check", label: "Quality check", tone: "cobalt" },
    { id: "shipped", label: "Shipped", tone: "violet" },
    { id: "delivered", label: "Delivered", tone: "moss" },
    { id: "exception", label: "Needs attention", tone: "signal" }
  ];

  const ORDERS = [
    { id: "DM-4821-0093", date: "Jul 28, 2026", state: "in_production", totalCents: 8640, items: [{ design: "Signal Decay", adapter: "tshirt", qty: 2, variant: "M · Bone" }, { design: "Meridian 04", adapter: "poster", qty: 1, variant: "50×70cm" }], factory: "Shenzhen Print Lab", eta: "Aug 4 – Aug 6", tracking: null },
    { id: "DM-4820-0088", date: "Jul 24, 2026", state: "shipped", totalCents: 4200, items: [{ design: "Vessel Study 12", adapter: "print3d", qty: 1, variant: "PLA · Terracotta" }], factory: "Rotterdam Additive", eta: "Aug 2", tracking: "DHL · 8842 1190 3321" },
    { id: "DM-4818-0071", date: "Jul 19, 2026", state: "delivered", totalCents: 12980, items: [{ design: "Lagos Bloom", adapter: "tshirt", qty: 3, variant: "L · Black" }, { design: "Prism Ritual", adapter: "sticker", qty: 4, variant: "Gloss" }], factory: "Austin DTG Works", eta: "Delivered Jul 27", tracking: "UPS · 1Z999AA10123456784" },
    { id: "DM-4816-0064", date: "Jul 11, 2026", state: "exception", totalCents: 6800, items: [{ design: "Modular Vase", adapter: "print3d", qty: 1, variant: "Resin · Ivory" }], factory: "Rotterdam Additive", eta: "Delayed — rerouting", tracking: null },
    { id: "DM-4812-0052", date: "Jun 30, 2026", state: "delivered", totalCents: 3200, items: [{ design: "Nocturne", adapter: "poster", qty: 1, variant: "A2" }], factory: "Berlin Giclée Studio", eta: "Delivered Jul 6", tracking: "DPD · 0154 8837 2210" }
  ];

  /* ---------- Agent Hub ---------- */
  const AGENTS = [
    { id: "agt_9f2a", name: "Claude Desktop", vendor: "Anthropic", type: "MCP", status: "active", scopes: ["catalog.read", "design.generate", "design.publish"], calls: 12840, lastActive: "2 min ago", key: "dsk_live_9f2a••••••••3c71" },
    { id: "agt_3b8c", name: "Studio Copilot", vendor: "Custom · OpenAI", type: "REST", status: "active", scopes: ["catalog.read", "orders.write", "manufacturing.read"], calls: 6210, lastActive: "18 min ago", key: "dsk_live_3b8c••••••••a049" },
    { id: "agt_71de", name: "Shopfront Sync", vendor: "n8n Workflow", type: "Webhook", status: "paused", scopes: ["catalog.read", "orders.read"], calls: 2405, lastActive: "3 days ago", key: "dsk_live_71de••••••••bb12" },
    { id: "agt_5c04", name: "Merch Scout", vendor: "LangGraph", type: "MCP", status: "review", scopes: ["catalog.read", "analytics.read"], calls: 0, lastActive: "pending approval", key: "dsk_test_5c04••••••••e5f8" }
  ];

  const SCOPES = [
    { id: "catalog.read", name: "Browse catalog", desc: "Search listings, read prices, availability and lead times.", risk: "low", on: true },
    { id: "design.generate", name: "Generate designs", desc: "Run AI image, upscale and background-removal jobs against your quota.", risk: "medium", on: true },
    { id: "design.publish", name: "Publish designs", desc: "Create listings through the D2M engine. Still enters human review.", risk: "medium", on: true },
    { id: "orders.write", name: "Place orders", desc: "Create carts and submit paid orders using your stored payment method.", risk: "high", on: true },
    { id: "manufacturing.read", name: "Track manufacturing", desc: "Read job status, factory routing and shipment tracking.", risk: "low", on: true },
    { id: "payouts.read", name: "Read earnings", desc: "Access balance, payout history and per-order revenue breakdown.", risk: "medium", on: false },
    { id: "account.write", name: "Manage account", desc: "Update profile, addresses and notification settings.", risk: "high", on: false }
  ];

  const AGENT_LOG = [
    { t: "19:04:12", agent: "Claude Desktop", action: "catalog.search", detail: 'q="minimal poster", limit=12', status: 200, ms: 84 },
    { t: "19:04:09", agent: "Claude Desktop", action: "design.generate", detail: 'prompt="brutalist grid poster, ember palette"', status: 202, ms: 12400 },
    { t: "18:58:41", agent: "Studio Copilot", action: "orders.create", detail: "listing=lst_88213 qty=2 · $64.00", status: 201, ms: 640 },
    { t: "18:52:03", agent: "Studio Copilot", action: "manufacturing.track", detail: "job=job_5521 → in_production", status: 200, ms: 61 },
    { t: "18:44:57", agent: "Claude Desktop", action: "design.publish", detail: "design=dsg_1057 adapters=[tshirt,poster]", status: 201, ms: 1830 },
    { t: "18:30:22", agent: "Merch Scout", action: "catalog.read", detail: "scope not granted", status: 403, ms: 12 },
    { t: "18:12:08", agent: "Shopfront Sync", action: "catalog.read", detail: "cursor=page_4", status: 200, ms: 97 }
  ];

  /* ---------- Notifications ---------- */
  const NOTIFS = [
    { type: "order", icon: "package", title: "Order DM-4821-0093 entered production", body: "Shenzhen Print Lab accepted the job. Estimated ship Aug 4.", time: "12 min ago", unread: true },
    { type: "review", icon: "shield", title: "Design approved", body: "“Ember Field” passed content review and is now live on 2 listings.", time: "1 hour ago", unread: true },
    { type: "social", icon: "heart", title: "Amara Okafor liked your design", body: "“Contour Map 09” — plus 42 others this week.", time: "3 hours ago", unread: true },
    { type: "payout", icon: "dollar", title: "Payout of $1,284.00 is on the way", body: "July settlement sent to your Stripe Connect account.", time: "Yesterday", unread: false },
    { type: "agent", icon: "terminal", title: "New agent requested access", body: "“Merch Scout” requests catalog.read and analytics.read.", time: "Yesterday", unread: false },
    { type: "order", icon: "truck", title: "Order DM-4820-0088 shipped", body: "DHL · 8842 1190 3321 — arriving Aug 2.", time: "2 days ago", unread: false }
  ];

  /* ---------- helpers ---------- */
  const money = (cents, cur) => (cur || "$") + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));

  global.DB = {
    ADAPTERS, adapterById,
    CREATORS, creatorByHandle,
    CATEGORIES,
    DESIGNS, designById, byCreator,
    ORDERS, ORDER_STATES,
    AGENTS, SCOPES, AGENT_LOG,
    NOTIFS,
    money, compact
  };
})(window);
