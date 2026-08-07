import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ContentPage, type ContentSection, type ContentCta } from "@/components/ContentPage";
import { CATEGORIES } from "@/lib/data";

type CData = {
  title: string;
  intro: string;
  sections: ContentSection[];
  cta: ContentCta;
};

// Build SEO landing pages for every real style category in the catalogue.
const DATA: Record<string, CData> = {
  abstract: {
    title: "Abstract designs — posters, tees and more, made on demand",
    intro:
      "Browse and publish abstract artwork on Desmake: generated or uploaded, adapted across six manufacturing methods and produced on demand, shipped worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Abstract, across the catalogue",
        intro: "One style, every product.",
        cards: [
          { badge: "Posters", title: "Giclée wall art", text: "Turn abstract compositions into gallery-grade prints with photoreal mockups." },
          { badge: "Apparel", title: "DTG / DTF tees", text: "Abstract patterns adapted for apparel with clean, edge-to-edge prints." },
          { badge: "More", title: "Stickers, cases, 3D", text: "Extend the same art to die-cut stickers, phone cases and 3D prints." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See abstract designs on Desmake",
      text: "Browse the live abstract collection and filter by product.",
      label: "Explore abstract",
      href: "/explore?category=abstract",
    },
  },
  typography: {
    title: "Typography designs — letterform art, made on demand",
    intro:
      "Quote tees, type posters and lettered merch. Publish typography designs on Desmake and let the network manufacture and ship them worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Type, across products",
        intro: "Words that wear well.",
        cards: [
          { badge: "Tees", title: "Statement apparel", text: "Crisp type adapted for DTG/DTF apparel with accurate colour." },
          { badge: "Posters", title: "Type posters", text: "Quote and display typography as giclée prints." },
          { badge: "More", title: "Stickers & cases", text: "Carry the message onto stickers and phone cases." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See typography designs on Desmake",
      text: "Browse the live typography collection and filter by product.",
      label: "Explore typography",
      href: "/explore?category=typography",
    },
  },
  geometric: {
    title: "Geometric designs — precise patterns, made on demand",
    intro:
      "Symmetry, grids and shapes. Publish geometric artwork on Desmake and have it produced across apparel, posters, stickers and more, shipped worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Geometry, across products",
        intro: "Clean lines, every surface.",
        cards: [
          { badge: "Posters", title: "Pattern prints", text: "Geometric compositions rendered as giclée wall art." },
          { badge: "Apparel", title: "Pattern tees", text: "Repeat and placement adapted for apparel printing." },
          { badge: "More", title: "Stickers & 3D", text: "Extend onto die-cut stickers and 3D-printed objects." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See geometric designs on Desmake",
      text: "Browse the live geometric collection and filter by product.",
      label: "Explore geometric",
      href: "/explore?category=geometric",
    },
  },
  illustration: {
    title: "Illustration designs — character & scene art, made on demand",
    intro:
      "Hand-drawn and AI illustration, from characters to scenes. Publish on Desmake and let the network manufacture and ship it worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Illustration, across products",
        intro: "Stories on surfaces.",
        cards: [
          { badge: "Apparel", title: "Illustrated tees", text: "Characters and scenes adapted for DTG/DTF apparel." },
          { badge: "Posters", title: "Scene prints", text: "Illustrations rendered as giclée wall art." },
          { badge: "More", title: "Stickers & cases", text: "Carry the art onto stickers and phone cases." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See illustration designs on Desmake",
      text: "Browse the live illustration collection and filter by product.",
      label: "Explore illustration",
      href: "/explore?category=illustration",
    },
  },
  minimal: {
    title: "Minimal designs — quiet style, made on demand",
    intro:
      "Less, but better. Publish minimal artwork on Desmake and have it produced across apparel, posters and more, shipped worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Minimal, across products",
        intro: "Restraint, everywhere.",
        cards: [
          { badge: "Posters", title: "Quiet prints", text: "Minimal compositions as giclée wall art." },
          { badge: "Apparel", title: "Clean tees", text: "Understated type and marks adapted for apparel." },
          { badge: "More", title: "Cases & stickers", text: "Extend the calm onto phone cases and stickers." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See minimal designs on Desmake",
      text: "Browse the live minimal collection and filter by product.",
      label: "Explore minimal",
      href: "/explore?category=minimal",
    },
  },
  retro: {
    title: "Retro designs — vintage vibes, made on demand",
    intro:
      "70s gradients, 80s neon, 90s grit. Publish retro artwork on Desmake and have it produced across apparel, posters and more, shipped worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Retro, across products",
        intro: "Nostalgia, every surface.",
        cards: [
          { badge: "Apparel", title: "Throwback tees", text: "Retro palettes adapted for DTG/DTF apparel." },
          { badge: "Posters", title: "Vintage prints", text: "Retro scenes rendered as giclée wall art." },
          { badge: "More", title: "Stickers & cases", text: "Carry the era onto stickers and phone cases." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See retro designs on Desmake",
      text: "Browse the live retro collection and filter by product.",
      label: "Explore retro",
      href: "/explore?category=retro",
    },
  },
  botanical: {
    title: "Botanical designs — nature art, made on demand",
    intro:
      "Leaves, blooms and botanicals. Publish botanical artwork on Desmake and let the network manufacture and ship it worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "Botanical, across products",
        intro: "Nature, every surface.",
        cards: [
          { badge: "Posters", title: "Botanical prints", text: "Plant studies rendered as giclée wall art." },
          { badge: "Apparel", title: "Garden tees", text: "Botanicals adapted for DTG/DTF apparel." },
          { badge: "More", title: "Stickers & cases", text: "Carry the garden onto stickers and phone cases." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See botanical designs on Desmake",
      text: "Browse the live botanical collection and filter by product.",
      label: "Explore botanical",
      href: "/explore?category=botanical",
    },
  },
  "3d": {
    title: "3D & object designs — physical objects, made on demand",
    intro:
      "Not just flat prints. Publish 3D and object designs on Desmake and have them produced via FDM/SLA 3D printing, shipped worldwide.",
    sections: [
      {
        layout: "cards",
        heading: "3D, off the screen",
        intro: "From render to object.",
        cards: [
          { badge: "3D print", title: "FDM / SLA", text: "Object designs produced on demand with no tooling cost." },
          { badge: "Apparel", title: "Object-on-product", text: "Render the object onto tees, cases and stickers too." },
          { badge: "Mockups", title: "Photoreal previews", text: "Preview the physical result before you publish." },
        ],
      },
      {
        layout: "bullets",
        heading: "Publish in minutes",
        intro: "From upload to listing.",
        items: [
          { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
          { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
          { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
        ],
      },
    ],
    cta: {
      eyebrow: "Explore",
      title: "See 3D & object designs on Desmake",
      text: "Browse the live 3D collection and filter by product.",
      label: "Explore 3D",
      href: "/explore?category=3d",
    },
  },
};

// Ensure every category id from the catalogue has a landing page.
for (const c of CATEGORIES) {
  if (c.id !== "all" && !DATA[c.id]) {
    DATA[c.id] = {
      title: `${c.name} designs — made on demand`,
      intro: `Publish ${c.name.toLowerCase()} artwork on Desmake and have it produced across six manufacturing methods, shipped worldwide.`,
      sections: [
        {
          layout: "bullets",
          heading: "Publish in minutes",
          intro: "From upload to listing.",
          items: [
            { title: "No inventory", text: "Produced only when ordered. No minimums, no upfront cost." },
            { title: "Worldwide", text: "Shipped from the node closest to the buyer across 34 countries." },
            { title: "Your margin", text: "Set 10%–50% per sale with a transparent cost breakdown." },
          ],
        },
      ],
      cta: {
        eyebrow: "Explore",
        title: `See ${c.name} designs on Desmake`,
        text: "Browse the live collection and filter by product.",
        label: `Explore ${c.name}`,
        href: `/explore?category=${c.id}`,
      },
    };
  }
}

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
    alternates: { canonical: `/categories/${slug}` },
    openGraph: { title: d.title, description: d.intro, url: `https://desmake.com/categories/${slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DATA[slug];
  if (!d) notFound();
  return (
    <ContentPage eyebrow="Categories" title={d.title} intro={d.intro} sections={d.sections} cta={d.cta} />
  );
}
