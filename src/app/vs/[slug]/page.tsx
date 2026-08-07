import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, type ContentSection, type ContentCta } from "@/components/ContentPage";

type VData = {
  name: string;
  title: string;
  intro: string;
  sections: ContentSection[];
  cta: ContentCta;
};

const DATA: Record<string, VData> = {
  printful: {
    name: "Printful",
    title: "Desmake vs Printful",
    intro:
      "Both turn designs into physical products — but Desmake is built for AI-native, agent-first selling. You publish one design and it is automatically adapted, mockup-rendered, copywritten, priced and listed across six manufacturing methods, instead of you hand-building a product for every SKU.",
    sections: [
      {
        layout: "cards",
        heading: "Where Desmake is different",
        intro: "The same design, far less manual work.",
        cards: [
          { badge: "AI-native", title: "One design, six methods", text: "Desmake adapts a single upload into apparel, posters, stickers, phone cases, business cards and 3D prints. Printful asks you to set up each product by hand." },
          { badge: "Agent-first", title: "MCP/API selling", text: "AI agents can search the catalogue, publish designs and place orders over MCP. Printful is a manual storefront or generic API — not agent commerce." },
          { badge: "Automation", title: "Design-to-Market in ~4 min", text: "Desmake analyses artwork, renders mockups, writes titles/descriptions/SEO and prices the listing. Printful leaves the merchandising to you." },
        ],
      },
      {
        layout: "bullets",
        heading: "What you keep doing",
        intro: "The parts that should stay yours.",
        items: [
          { title: "Your royalty", text: "Set 10%–50% per sale, exactly like on Printful — but with a live cost breakdown on every order." },
          { title: "No upfront cost", text: "On-demand production with no inventory, no minimums and no listing fees, same as Printful." },
          { title: "Worldwide shipping", text: "Orders route to the manufacturing node with the best cost-to-door across 34 countries." },
        ],
      },
      {
        layout: "prose",
        heading: "The short version",
        body: (
          <p className="lead muted">
            Choose <strong>Printful</strong> if you want a traditional print-on-demand backend and don&apos;t mind building every product yourself. Choose{" "}
            <strong>Desmake</strong> if you want one AI-generated or uploaded design to become a sellable, agent-accessible product line in minutes.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "Try it",
      title: "Publish one design, get six product lines",
      text: "Upload or generate a design in Studio and watch it adapt across the whole catalogue.",
      label: "Open Studio",
      href: "/studio",
    },
  },
  printify: {
    name: "Printify",
    title: "Desmake vs Printify",
    intro:
      "Printify gives you a big supplier network and a manual storefront. Desmake adds an AI Design-to-Market pipeline and an MCP/API layer so autonomous agents can create and sell products — without you wiring up each supplier.",
    sections: [
      {
        layout: "cards",
        heading: "Where Desmake is different",
        intro: "Less setup, more automation.",
        cards: [
          { badge: "AI-native", title: "Auto-adapted catalogue", text: "One design becomes every relevant product automatically. Printify requires you to pick suppliers and build each product one by one." },
          { badge: "Agent-first", title: "MCP server", text: "Install with npx -y @desmake/mcp and a scoped key; agents get catalog.search, design.generate, design.publish, orders.create and more. Printify has no agent-commerce surface." },
          { badge: "Pricing", title: "Transparent cost", text: "Every listing shows manufacturing cost, your margin and retail price. No guessing at supplier margins." },
        ],
      },
      {
        layout: "bullets",
        heading: "What you keep doing",
        intro: "The things that matter to a creator.",
        items: [
          { title: "Your margin", text: "Set a royalty between 10% and 50% per sale, with a clear breakdown on every order." },
          { title: "No inventory", text: "Produced on demand, shipped from the node closest to the buyer. No stock, no minimums." },
          { title: "Payouts", text: "Creator earnings accrue per order and pay out across 34 shipping countries." },
        ],
      },
      {
        layout: "prose",
        heading: "The short version",
        body: (
          <p className="lead muted">
            <strong>Printify</strong> is a strong fit if you want hands-on control of suppliers and a classic storefront. <strong>Desmake</strong> is for creators and builders who want AI and agents to do the merchandising.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "Try it",
      title: "Let the pipeline do the merchandising",
      text: "Generate a design and publish it across the catalogue in one flow.",
      label: "Open Studio",
      href: "/studio",
    },
  },
  redbubble: {
    name: "Redbubble",
    title: "Desmake vs Redbubble",
    intro:
      "Redbubble is a marketplace that spreads one artwork across many products behind a fixed royalty. Desmake is an AI-native, agent-first marketplace where you set your own margin, keep a transparent cost breakdown, and let AI agents sell for you.",
    sections: [
      {
        layout: "cards",
        heading: "Where Desmake is different",
        intro: "More control, more automation.",
        cards: [
          { badge: "Margin", title: "You set the price", text: "Desmake lets you choose a 10%–50% royalty per sale and see the exact manufacturing cost. Redbubble uses a fixed artist margin you can't negotiate." },
          { badge: "AI-native", title: "Generate, don't just upload", text: "Create new artwork inside Studio, then auto-adapt it across six manufacturing methods. Redbubble only takes what you upload." },
          { badge: "Agent-first", title: "Sell via MCP", text: "Agents can publish and fulfil on Desmake. Redbubble has no agent-commerce path." },
        ],
      },
      {
        layout: "bullets",
        heading: "What you keep doing",
        intro: "Creator-friendly, like Redbubble.",
        items: [
          { title: "No upfront cost", text: "Nothing to pay until something sells. No subscription to list your work." },
          { title: "Worldwide reach", text: "On-demand production ships from the node closest to each buyer across 34 countries." },
          { title: "Your IP", text: "You publish your own original or AI-generated designs and keep control of the listing." },
        ],
      },
      {
        layout: "prose",
        heading: "The short version",
        body: (
          <p className="lead muted">
            <strong>Redbubble</strong> is a simple upload-and-earn marketplace. <strong>Desmake</strong> gives you higher control over pricing, AI generation in the loop, and an agent-commerce channel on top.
          </p>
        ),
      },
    ],
    cta: {
      eyebrow: "Try it",
      title: "Set your own margin and let AI adapt the art",
      text: "Publish a design once and price it the way you want.",
      label: "Open Studio",
      href: "/studio",
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
    alternates: { canonical: `/vs/${slug}` },
    openGraph: { title: d.title, description: d.intro, url: `https://desmake.com/vs/${slug}` },
  };
}

export default async function VersusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DATA[slug];
  if (!d) notFound();
  return <ContentPage eyebrow="Versus" title={d.title} intro={d.intro} sections={d.sections} cta={d.cta} />;
}
