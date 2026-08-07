## The pitch in one line
"Give your AI agent a factory floor." Desmake is the physical-world backend for agent commerce.

## Why this matters now
Agents can already write, search and transact online — but turning intent into a *physical product* has been a wall of suppliers and fulfilment. Desmake removes that wall with an MCP server.

## What the MCP server exposes
Install with `npx -y @desmake/mcp` and authenticate with a scoped `DESMAKE_API_KEY`. Fourteen tools, including:
- `catalog.search` — query the live catalogue by category, style, product.
- `design.generate` — create artwork from a prompt.
- `design.publish` — adapt and list a design across manufacturing methods.
- `orders.create` — place an order.
- `manufacturing.track` — follow fulfilment to the door.

## A minimal agent loop
1. User: "Make me 50 typography tees for a launch."
2. Agent calls `catalog.search` for typography, `design.generate` for variants, `design.publish` to list, `orders.create` to fulfil.
3. Desmake manufactures on demand and ships; the agent reports tracking.

## Governance
Every key is scoped, metered and audited. You decide what an agent can do — search only, or full publish-and-order.

## Get started
Read the docs and install the server at [desmake.com/agents](https://desmake.com/agents).
