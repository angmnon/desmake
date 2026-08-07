import fs from "node:fs";
import path from "node:path";

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

const DIR = path.join(process.cwd(), "src/content/blog");

export type BlogPost = BlogPostMeta & { body: string };

export function getPost(slug: string): BlogPost | undefined {
  const meta = RAW.find((r) => r.slug === slug);
  if (!meta) return undefined;
  try {
    const body = fs.readFileSync(path.join(DIR, meta.file), "utf8");
    return { ...meta, body };
  } catch {
    return undefined;
  }
}

export function getAllPosts(): BlogPostMeta[] {
  return RAW.map(({ file, ...m }) => m).sort((a, b) => b.date.localeCompare(a.date));
}

export function getSlugs(): string[] {
  return RAW.map((r) => r.slug);
}
