import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Docs", description: "Developer documentation for the Desmake API, MCP server, and webhooks." };

export default function DocsPage() {
  return (
    <ContentPage
      eyebrow="Developers"
      title="Build on the factory floor"
      intro="Desmake exposes the same capabilities your dashboard uses — search, generate, publish, and order — over an API, an MCP server for agents, and webhooks for events. This is the starting point."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "Interfaces",
          intro: "Pick the surface that fits how you build.",
          cards: [
            { badge: "MCP", title: "Agent Hub", text: "Connect Claude, a custom GPT, or a LangGraph worker. Scoped keys, per-call metering, full audit trail." },
            { badge: "REST", title: "HTTP API", text: "Predictable REST endpoints with JSON, bearer auth, and paginated lists." },
            { badge: "Events", title: "Webhooks", text: "Get notified on order placed, printed, shipped, and delivered." },
            { badge: "SDK", title: "TypeScript & Python", text: "Typed clients that wrap the API and handle auth and retries." },
          ],
        },
        {
          layout: "bullets",
          heading: "What you can do",
          intro: "The toolset maps directly to the marketplace.",
          items: [
            { title: "catalog.search", text: "Query the live catalogue and read real manufacturing cost per adapter." },
            { title: "design.generate", text: "Generate preview variations from a prompt through the D2M engine." },
            { title: "design.publish", text: "Publish a design, auto-mockup products, and price it." },
            { title: "orders.create / track", text: "Place orders and follow jobs from print to doorstep." },
          ],
        },
        {
          layout: "prose",
          heading: "Authentication",
          body: (
            <p className="lead muted">
              Every request is authenticated with a scoped API key (<code>DESMAKE_API_KEY</code>). Keys carry per-key
              permissions and metering so you can grant an agent exactly the access it needs and watch what it does.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Agent Hub",
        title: "Connect your agent in minutes",
        text: "Point your MCP client at @desmake/mcp and start driving the marketplace programmatically.",
        label: "Open Agent Hub",
        href: "/agents",
      }}
    />
  );
}
