## Hook
"Agent commerce" sounds like a buzzword until you watch an AI agent pick a product, generate artwork, publish it and place the order — without a human clicking buy. The protocol making that real in 2026 is MCP (Model Context Protocol). Here is what MCP commerce is, why it matters, and how Desmake is built for it.

## What is MCP?
The Model Context Protocol is an open standard that lets an AI model talk to external tools and data through a common interface. Instead of every app writing a custom integration, an agent connects once and calls *tools* — search, create, update, order.

## What is MCP commerce?
Commerce over MCP means the agent becomes the shopper and the merchant. With a scoped API key, an agent can:
1. **Search** a catalogue for the right product or design.
2. **Generate** new artwork and **publish** it as a live listing.
3. **Price** it against real manufacturing cost.
4. **Place and track orders** to fulfilment.

The human sets the guardrails (budget, permissions, brand rules); the agent runs the loop.

## Why it is a big deal for creators
Today, selling means you do the merchandising. With MCP commerce:
- A creator can delegate "keep my storefront fresh" to an agent that publishes new designs on a schedule.
- A brand can let an agent restock and customize merch for a campaign automatically.
- A developer can embed "make me a product" inside any AI app.

## Why Desmake is MCP-first
Most commerce platforms are websites with an API bolted on. Desmake was designed MCP/API-first:
- An MCP server installable with `npx -y @desmake/mcp` and a scoped `DESMAKE_API_KEY`.
- 14 tools including `catalog.search`, `design.generate`, `design.publish`, `orders.create` and `manufacturing.track`.
- Scoped keys, per-key metering and a full audit trail, so an agent can act without holding the keys to the kingdom.

## REST, webhooks and SDKs too
MCP is the headline, but the same capabilities are available over REST, webhooks and TypeScript/Python SDKs — so you can wire Desmake into any stack, agentic or not.

## The trust question
Letting an agent spend money sounds risky. Desmake scopes every key (read-only vs publish vs order), meters usage per key, and logs every action. You grant exactly the powers an agent needs and nothing more.

## FAQ
**What is MCP commerce?** It is buying and selling through the Model Context Protocol, where an AI agent uses standardised tools to search, generate, publish and order products instead of a human using a website.

**Can an AI agent really place real orders?** Yes. On an MCP-first platform like Desmake, an agent with a scoped key can generate a design, publish it, price it against live manufacturing cost and place a real order — all within the permissions you grant.

**Is MCP commerce safe?** It is as safe as the scopes you set. Desmake uses scoped API keys, per-key metering and a full audit trail, so an agent can only do what you explicitly allow.

**How do I connect an agent to Desmake?** Install the MCP server with `npx -y @desmake/mcp`, supply a scoped `DESMAKE_API_KEY`, and the agent gains tools like catalog.search and design.publish. See the [agent hub](https://desmake.com/agents) and [docs](https://desmake.com/docs).

## Get started
Give your agent a factory floor at [desmake.com/agents](https://desmake.com/agents), or read the [MCP build guide](https://desmake.com/docs).
