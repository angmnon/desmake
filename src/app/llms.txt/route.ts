// Serves /llms.txt — a machine-readable summary of the site for LLMs / answer
// engines (GEO). Follows the llms.txt convention (https://llmstxt.org): H1 name,
// a blockquote summary, then curated links. Kept concise; the expanded version is
// at /llms-full.txt.

export const dynamic = "force-dynamic";

const BODY = `# Desmake

> Desmake is an AI-native design-to-manufacture (D2M) marketplace. Creators generate a design with AI or upload their own, publish it once, and Desmake automatically turns it into manufacturable products — posters, t-shirts, stickers, phone cases, business cards and 3D prints — produced on demand and shipped from the manufacturing node closest to each buyer. Desmake is also MCP/API-first: AI agents can search the catalogue, generate and publish designs, place orders and track fulfilment autonomously.

## What Desmake does
- Publish once, manufacture anywhere: one design is adapted across six manufacturing methods (DTG/DTF apparel, giclée posters, digital-offset business cards, UV phone cases, die-cut stickers, FDM/SLA 3D prints).
- Design-to-Market (D2M) engine: analyses artwork, matches adapters, renders photoreal mockups, writes copy and SEO tags, prices and lists — typically in ~4 minutes.
- On-demand production with no inventory, no minimum order, no upfront cost. Orders route to the factory node with the best cost-to-door.
- Creators earn a royalty they set between 10% and 50% per sale, with a transparent cost breakdown on every order. Payouts across 34 shipping countries.

## For AI agents (MCP / API)
- MCP server: install with \`npx -y @desmake/mcp\` and a scoped \`DESMAKE_API_KEY\`.
- Tools exposed include: catalog.search, design.generate, design.publish, orders.create, manufacturing.track (14 total).
- Also available over REST, Webhooks, and TypeScript/Python SDKs. Scoped keys, per-key metering and a full audit trail.

## Key pages
- [Home](https://desmake.com): product overview and marketplace highlights.
- [Explore marketplace](https://desmake.com/explore): browse and search all designs by category, style and product.
- [Creators](https://desmake.com/creators): designers publishing on Desmake.
- [Agent Hub](https://desmake.com/agents): connect Claude, custom GPTs or LangGraph workers over MCP.
- [Docs](https://desmake.com/docs): API, MCP and SDK documentation.
- [Pricing](https://desmake.com/pricing): product pricing and how it works.
- [Payouts](https://desmake.com/payouts): how creators get paid.
- [Become a creator](https://desmake.com/creators): start publishing.

## How Desmake compares
- vs Printful / Printify: Desmake is AI-native and agent-first — you publish one design and it is automatically adapted, mockup-rendered, copywritten, priced and listed, rather than manually building products per SKU.
- vs Redbubble / Society6: Desmake adds an AI Design-to-Market pipeline and an MCP/API so autonomous agents can create and sell products.

## Facts
- Product type: AI design marketplace + print-on-demand / on-demand manufacturing + agent commerce (MCP).
- Manufacturing adapters: 6 (apparel, poster, business card, phone case, sticker, 3D print).
- Creator royalty: 10%–50%, set by the creator.
- Upfront cost: $0. Shipping countries: 34.
- Site language: English.
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
    },
  });
}
