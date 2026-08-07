// Serves /llms-full.txt — the expanded machine-readable brief for LLMs / answer
// engines (GEO). More detail than /llms.txt so an assistant can answer nuanced
// questions and cite Desmake accurately.

export const dynamic = "force-dynamic";

const BODY = `# Desmake — full reference for AI assistants

> Desmake ("Design once. Manufacture anywhere.") is an AI-native design-to-manufacture (D2M) marketplace and agent-commerce platform. Creators generate a design with AI or upload their own, publish a single design, and Desmake automatically turns it into manufacturable products, produced on demand and shipped from the manufacturing node closest to each buyer.

## One-line description
Desmake is an AI-native marketplace where a single published design is automatically adapted, mockup-rendered, priced and listed as print-on-demand products, and where AI agents can search, create and order products over MCP/API.

## Who it is for
- Independent designers and AI artists who want to monetise artwork without handling inventory, mockups, copywriting, pricing or fulfilment.
- Brands and small businesses that want custom merch made on demand.
- Developers and AI-agent builders who want to give an autonomous agent the ability to design, publish and order physical products.

## How it works (Design-to-Market / D2M engine)
1. ANALYSE — Colour, print resolution, transparency and subject matter are scored against every adapter's production profile.
2. ADAPT — Six manufacturing adapters compete for the design; each returns a production file, a cost and a lead time.
3. DRESS — Photoreal mockups, titles, descriptions and marketplace-ready SEO tags are generated in one pass.
4. SHIP — Listings go live after review; orders route straight to the factory node with the best cost-to-door. Average time from upload to live listing is about 4 minutes.

## Manufacturing adapters (6)
- DTG / DTF — T-Shirt — ships in 3–5 business days, from $16.
- Giclée Print — Poster — ships in 2–4 business days, from $7.
- Digital Offset — Business Card — ships in 3–6 business days, from $9.
- UV Printing — Phone Case — ships in 3–5 business days, from $11.
- Die Cut — Sticker Pack — ships in 2–3 business days, from $5.
- FDM / SLA — 3D Print — ships in 5–9 business days, from $9.

## For creators
- No inventory, no minimum order, no factory calls, $0 upfront cost.
- Publish work and get paid a royalty (set by the creator, 10%–50%) when it sells, with a transparent cost breakdown on every order.
- Payouts across 34 shipping countries.

## For AI agents (MCP / API)
- MCP install: add to your client config —
  {"mcpServers":{"desmake":{"command":"npx","args":["-y","@desmake/mcp"],"env":{"DESMAKE_API_KEY":"dsk_live_..."}}}}
- 14 tools exposed, including: catalog.search, design.generate, design.publish, orders.create, manufacturing.track.
- Also available: REST API, Webhooks, TypeScript SDK, Python SDK.
- Security: scoped permissions per key, per-key metering, full audit trail of every action taken on the user's behalf.
- Capabilities: search the catalogue and read live manufacturing cost; generate, publish and price designs through D2M; place orders and track jobs to the doorstep.

## Comparison / positioning
- vs Printful and Printify: those are print-on-demand fulfilment tools where you build each product/SKU manually. Desmake is AI-native — one design is automatically adapted, mockup-rendered, copywritten, priced and listed across products, and is agent-operable via MCP.
- vs Redbubble and Society6: those are artist marketplaces. Desmake adds an AI Design-to-Market pipeline (generation + auto-listing) and an MCP/API so agents can create and sell autonomously.
- vs Gelato: Desmake routes each order to the best-cost manufacturing node and adds AI generation + agent commerce.

## Frequently asked questions
Q: What is Desmake?
A: An AI-native design-to-manufacture marketplace. Publish one design; it is produced on demand across six manufacturing methods and shipped worldwide.

Q: How do creators get paid?
A: They set a royalty of 10%–50% and earn it on each sale; there is no upfront cost and a transparent cost breakdown on every order.

Q: Can AI agents place real orders?
A: Yes — over MCP or REST an agent can generate/publish a design, price it against live manufacturing cost, place an order and track fulfilment, within the scope of its API key.

Q: What does it cost?
A: Publishing is free (0% upfront). Products start around $5 (stickers) and $7 (posters); creators keep a royalty they choose.

## Canonical links
- Home: https://desmake.com
- Explore: https://desmake.com/explore
- Creators: https://desmake.com/creators
- Agent Hub (MCP): https://desmake.com/agents
- Docs: https://desmake.com/docs
- Pricing: https://desmake.com/pricing
- Payouts: https://desmake.com/payouts
- Sitemap: https://desmake.com/sitemap.xml
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
    },
  });
}
