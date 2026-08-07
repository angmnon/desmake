import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, type ContentSection, type ContentCta } from "@/components/ContentPage";

type UData = {
  title: string;
  intro: string;
  sections: ContentSection[];
  cta: ContentCta;
};

const DATA: Record<string, UData> = {
  "ai-artist": {
    title: "For AI artists: sell your art without learning print production",
    intro:
      "You generate with Midjourney, Stable Diffusion or DALL·E. Desmake turns that art into posters, tees, stickers, phone cases, business cards and 3D prints — produced on demand and shipped worldwide — without you touching a single supplier.",
    sections: [
      {
        layout: "cards",
        heading: "From prompt to product line",
        intro: "One image becomes a sellable catalogue.",
        cards: [
          { badge: "Upload", title: "Bring your render", text: "Drop in your AI artwork. Desmake analyses it and adapts it across six manufacturing methods." },
          { badge: "Adapt", title: "Auto mockups", text: "Photoreal product mockups are rendered for every relevant SKU — no Photoshop, no manual setup." },
          { badge: "Earn", title: "Set your royalty", text: "Choose 10%–50% per sale. Watch earnings accrue with a transparent cost breakdown on every order." },
        ],
      },
      {
        layout: "bullets",
        heading: "Why creators switch",
        intro: "Less operations, more making.",
        items: [
          { title: "Zero inventory", text: "Nothing is printed until it sells. No minimums, no upfront cost, no warehouse." },
          { title: "Worldwide shipping", text: "Orders route to the manufacturing node with the best cost-to-door across 34 countries." },
          { title: "Agent-ready", text: "Publish once and let AI agents surface and sell your work through MCP." },
        ],
      },
      {
        layout: "prose",
        heading: "The pitch",
        body: (
          <p className="lead muted">
            You already make the art. Desmake handles the manufacturing, fulfilment and storefront so you can keep generating instead of learning print logistics.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "Get started",
      title: "Turn your renders into a storefront",
      text: "Upload a design and publish it across the whole catalogue in minutes.",
      label: "Open Studio",
      href: "/studio",
    },
  },
  "merch-brand": {
    title: "For brands: custom merch without a supply chain team",
    intro:
      "Need branded tees, stickers, packaging or 3D-printed swag but don't have a production team? Desmake turns your brand assets into on-demand products, produced and shipped from the node closest to each recipient.",
    sections: [
      {
        layout: "cards",
        heading: "Merch that scales with you",
        intro: "From a launch drop to ongoing swag.",
        cards: [
          { badge: "Brand", title: "Your assets, on products", text: "Upload logos and artwork; Desmake adapts them across apparel, stickers, phone cases, business cards and 3D prints." },
          { badge: "Fulfil", title: "No warehouse", text: "Every item is made to order and shipped worldwide — no inventory to hold or forecast." },
          { badge: "Control", title: "Set your margin", text: "Internal or resale pricing with a transparent cost breakdown on each order." },
        ],
      },
      {
        layout: "bullets",
        heading: "Built for lean teams",
        intro: "Operations, minus the ops hire.",
        items: [
          { title: "Launch fast", text: "Go from asset to live storefront in an afternoon, not a quarter." },
          { title: "Global reach", text: "34 shipping countries with cost-to-door routing per order." },
          { title: "No minimums", text: "Order one or one thousand; the unit economics stay the same." },
        ],
      },
      {
        layout: "prose",
        heading: "The pitch",
        body: (
          <p className="lead muted">
            Desmake is the supply chain you don&apos;t have to hire — design, produce and ship branded products on demand.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "Get started",
      title: "Build your merch line today",
      text: "Upload brand assets and publish across the catalogue.",
      label: "Open Studio",
      href: "/studio",
    },
  },
  "agent-commerce": {
    title: "For AI agents: a factory floor your agent can call",
    intro:
      "Desmake is MCP/API-first. Give your agent a scoped key and it can search the catalogue, generate and publish designs, place orders and track fulfilment — turning natural-language intent into physical products.",
    sections: [
      {
        layout: "cards",
        heading: "Agent commerce, end to end",
        intro: "Fourteen tools, one scoped key.",
        cards: [
          { badge: "MCP", title: "npx -y @desmake/mcp", text: "Install the MCP server and connect Claude, a custom GPT or a LangGraph worker with a DESMAKE_API_KEY." },
          { badge: "Tools", title: "14 exposed tools", text: "catalog.search, design.generate, design.publish, orders.create, manufacturing.track and more." },
          { badge: "Govern", title: "Scoped keys + metering", text: "Per-key scopes, usage metering and a full audit trail for every agent action." },
        ],
      },
      {
        layout: "bullets",
        heading: "What agents can do",
        intro: "From intent to fulfilment.",
        items: [
          { title: "Search & recommend", text: "Query the live catalogue by category, style and product." },
          { title: "Create & publish", text: "Generate artwork, adapt it across manufacturing methods and list it." },
          { title: "Order & track", text: "Place orders and follow fulfilment to the buyer's door." },
        ],
      },
      {
        layout: "prose",
        heading: "The hook",
        body: (
          <p className="lead muted">
            &ldquo;Give your AI agent a factory floor.&rdquo; Desmake is the physical-world backend for agent commerce — programmatic, scoped and auditable.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "For builders",
      title: "Connect your agent to manufacturing",
      text: "Read the docs and install the MCP server.",
      label: "Agent Hub",
      href: "/agents",
    },
  },
};

export function generateStaticParams() {
  return Object.keys(DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = DATA[slug];
  if (!d) return {};
  return {
    title: d.title,
    description: d.intro,
    alternates: { canonical: `/use-cases/${slug}` },
    openGraph: { title: d.title, description: d.intro, url: `https://desmake.com/use-cases/${slug}` },
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DATA[slug];
  if (!d) notFound();
  return <ContentPage eyebrow="Use cases" title={d.title} intro={d.intro} sections={d.sections} cta={d.cta} />;
}
