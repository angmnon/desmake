import type { Metadata } from "next";
import { JsonLd, SITE_URL } from "@/components/JsonLd";

// /explore is a client component (filter/search state) so metadata lives here.
export const metadata: Metadata = {
  title: "Explore the marketplace — AI & original designs on demand",
  description:
    "Browse thousands of AI-generated and original designs on Desmake. Filter by category, style and product — posters, tees, stickers, phone cases, business cards and 3D prints — each made on demand and shipped worldwide.",
  keywords: [
    "browse AI art",
    "design marketplace",
    "buy print on demand",
    "AI generated posters",
    "custom t-shirts",
    "sticker packs",
  ],
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Explore the marketplace · Desmake",
    description:
      "Thousands of AI-generated and original designs, each made on demand and shipped worldwide.",
    url: `${SITE_URL}/explore`,
    type: "website",
    images: [{ url: "/og.png", alt: "Explore Desmake" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

const collectionLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Explore the Desmake marketplace",
  url: `${SITE_URL}/explore`,
  isPartOf: { "@type": "WebSite", name: "Desmake", url: SITE_URL },
  about: "AI-generated and original designs available as print-on-demand products.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={collectionLd} />
      {children}
    </>
  );
}
