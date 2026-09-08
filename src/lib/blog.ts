// B1 migration: blog markdown is inlined at build time into `blogContent.generated.ts`
// (see scripts/gen-blog-content.mjs) and bundled with the Worker, so the runtime needs
// no `node:fs` / `process.cwd()` (both unavailable on Cloudflare Workers).
import { BLOG_CONTENT } from "./blogContent.generated";

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO yyyy-mm-dd
  updated?: string;
  readingMinutes: number;
  tags: string[];
  author: string;
};

type Raw = BlogPostMeta & { file: string };

const RAW: Raw[] = [
  {
    slug: "how-much-designers-earn-per-sale",
    title: "How Much Do You Actually Earn Per Sale? POD Royalties Explained With Real Numbers",
    excerpt:
      "A 30% royalty on a $15 item is not $4.50. A transparent breakdown of royalty bases, freight costs and real per-item earnings using data from a 43-product catalog.",
    date: "2026-09-08",
    readingMinutes: 8,
    tags: ["royalties", "creators", "pricing", "print on demand"],
    author: "Desmake",
    file: "how-much-designers-earn-per-sale.md",
  },
  {
    slug: "passive-income-selling-ai-art",
    title: "How to Make Passive Income Selling AI Art (Step-by-Step, 2026)",
    excerpt:
      "Selling AI art can be genuinely passive — if the merchandising is automated. A practical playbook for building a hands-off royalty stream.",
    date: "2026-08-10",
    readingMinutes: 6,
    tags: ["AI art", "passive income", "creators"],
    author: "Desmake",
    file: "passive-income-selling-ai-art.md",
  },
  {
    slug: "mcp-commerce-explained",
    title: "MCP Commerce Explained: How AI Agents Buy and Sell for You (2026)",
    excerpt:
      "What the Model Context Protocol means for commerce, why agent commerce needs scoped keys, and how Desmake is built MCP-first for autonomous selling.",
    date: "2026-08-10",
    readingMinutes: 5,
    tags: ["agent commerce", "MCP"],
    author: "Desmake",
    file: "mcp-commerce-explained.md",
  },
  {
    slug: "ai-art-copyright-legal-guide",
    title: "AI Art Copyright & Selling: What Creators Need to Know (2026)",
    excerpt:
      "Is AI-generated art copyrightable? Can you sell it commercially? A practical legal guide to owning, licensing and protecting AI art you create.",
    date: "2026-08-10",
    readingMinutes: 5,
    tags: ["AI art", "copyright", "legal"],
    author: "Desmake",
    file: "ai-art-copyright-legal-guide.md",
  },
  {
    slug: "best-print-on-demand-services-2026",
    title: "Best Print-on-Demand Services for AI Artists in 2026 (Compared)",
    excerpt:
      "Manual POD backends vs AI-native design-to-manufacture — how Printful, Printify, Redbubble and Desmake compare for creators generating art with AI.",
    date: "2026-08-10",
    readingMinutes: 6,
    tags: ["print on demand", "comparison", "creators"],
    author: "Desmake",
    file: "best-print-on-demand-services-2026.md",
  },
  {
    slug: "how-to-sell-ai-art-without-inventory",
    title: "How to Sell AI Art Without Inventory: A Complete Guide (2026)",
    excerpt:
      "Turn a 30-second AI image into a sellable poster, tee or sticker — no suppliers, mockups or spreadsheets. Here is the Design-to-Market playbook.",
    date: "2026-08-07",
    readingMinutes: 6,
    tags: ["AI art", "print on demand", "creators"],
    author: "Desmake",
    file: "how-to-sell-ai-art-without-inventory.md",
  },
  {
    slug: "desmake-vs-printful",
    title: "Desmake vs Printful: What AI-Native Design-to-Manufacture Changes (2026)",
    excerpt:
      "Printful is a POD backend you run by hand. Desmake merchandises your design for you and adds an MCP server for agent commerce. A side-by-side.",
    date: "2026-08-07",
    readingMinutes: 5,
    tags: ["comparison", "print on demand"],
    author: "Desmake",
    file: "desmake-vs-printful.md",
  },
  {
    slug: "give-your-ai-agent-a-factory-floor",
    title: "Give Your AI Agent a Factory Floor: Building with Desmake MCP (2026)",
    excerpt:
      "Desmake is the physical-world backend for agent commerce. Install the MCP server and let agents search, generate, publish and fulfil — with scoped keys.",
    date: "2026-08-07",
    readingMinutes: 5,
    tags: ["agent commerce", "MCP"],
    author: "Desmake",
    file: "give-your-ai-agent-a-factory-floor.md",
  },
  {
    slug: "10-ai-art-styles-that-sell",
    title: "10 AI Art Styles That Sell Best as Posters and Tees (2026)",
    excerpt:
      "From abstract gradients to botanical illustration, these styles consistently list and sell on Desmake. Plus how to build a coherent storefront around them.",
    date: "2026-08-07",
    readingMinutes: 4,
    tags: ["AI art", "styles"],
    author: "Desmake",
    file: "10-ai-art-styles-that-sell.md",
  },
  {
    slug: "how-desmake-routes-orders",
    title: "How Desmake Routes Your Order to the Best Factory Node (2026)",
    excerpt:
      "A single print shop means one price and one shipping zone. Desmake matches every order to the manufacturing node with the best cost-to-door. Here is how.",
    date: "2026-08-07",
    readingMinutes: 4,
    tags: ["manufacturing", "fulfilment"],
    author: "Desmake",
    file: "how-desmake-routes-orders.md",
  },
  {
    slug: "agent-commerce-future",
    title: "The Future of Agent Commerce: AI That Designs, Prices and Ships (2026)",
    excerpt:
      "Commerce is becoming programmable. Desmake is built MCP-first so agents can complete the whole loop — intent to fulfilment — without a human clicking buy.",
    date: "2026-08-07",
    readingMinutes: 5,
    tags: ["agent commerce", "future"],
    author: "Desmake",
    file: "agent-commerce-future.md",
  },
];

export type BlogPost = BlogPostMeta & { body: string };

export function getPost(slug: string): BlogPost | undefined {
  const meta = RAW.find((r) => r.slug === slug);
  if (!meta) return undefined;
  const body = BLOG_CONTENT[meta.file];
  if (!body) return undefined;
  return { ...meta, body };
}

export function getAllPosts(): BlogPostMeta[] {
  return RAW.map(({ file, ...m }) => m).sort((a, b) => b.date.localeCompare(a.date));
}

export function getSlugs(): string[] {
  return RAW.map((r) => r.slug);
}

/** Extract Q/A pairs from a post's `## FAQ` markdown section, for FAQPage JSON-LD.
 *  Matches the existing `**Question?** Answer.` line format used across posts. */
export function parseFaq(body: string): { q: string; a: string }[] {
  const m = body.match(/##\s*FAQ([\s\S]*?)(?:\n##\s|$)/i);
  if (!m) return [];
  const out: { q: string; a: string }[] = [];
  for (const line of m[1].split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const mm = t.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (mm) out.push({ q: mm[1].trim(), a: mm[2].trim() });
  }
  return out;
}
