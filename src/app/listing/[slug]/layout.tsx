import type { Metadata } from "next";
import { findListingBySlug, publishedToDesign } from "@/lib/catalog";
import { allPublishedDesigns } from "@/lib/stores";
import { CREATORS, money, type Design } from "@/lib/data";
import { JsonLd, SITE_URL } from "@/components/JsonLd";

/**
 * Server segment layout for /listing/<slug>. The page itself is a client
 * component (needs cart/interaction state), so it cannot export generateMetadata.
 * This layout wraps it to give every one of the marketplace's product pages a
 * UNIQUE title, description, canonical, Open Graph image and Product JSON-LD —
 * the highest-impact SEO change for the whole catalogue. Non-invasive: the page's
 * runtime behaviour is unchanged.
 */

async function resolveDesign(slug: string): Promise<Design | undefined> {
  let design = findListingBySlug(slug);
  try {
    const fresh = (await allPublishedDesigns()).find((p) => p.slug === slug);
    if (fresh) design = publishedToDesign(fresh);
  } catch {
    /* D1 disabled — keep seed/in-memory result */
  }
  return design;
}

function ogImageFor(design?: Design): string {
  const img = design?.imageUrl;
  if (img && img.startsWith("/")) return img; // /cdn/... served by the Worker
  return "/og.png";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const design = await resolveDesign(slug);
  if (!design) {
    return { title: "Design not found", robots: { index: false, follow: true } };
  }
  const creator = CREATORS.find((c) => c.handle === design.creator);
  const creatorName = creator?.name ?? design.creator;
  const from = money(design.priceCents);
  const products = Array.from(new Set((design.tags ?? []).slice(0, 3)));
  const title = `${design.title} by ${creatorName}`;
  const description =
    design.description?.slice(0, 155) ||
    `${design.title} — ${design.aiGenerated ? "AI-generated" : "original"} ${design.category} design by ${creatorName}. Available on demand from ${from} as ${products.length ? products.join(", ") : "posters, tees, stickers and more"}, printed and shipped worldwide by Desmake.`;
  const canonical = `/listing/${encodeURIComponent(slug)}`;
  const ogImg = ogImageFor(design);

  return {
    title,
    description,
    keywords: [design.category, ...(design.tags ?? []), creatorName, "print on demand", "buy art print"],
    alternates: { canonical },
    openGraph: {
      title: `${title} · Desmake`,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "website",
      images: [{ url: ogImg, alt: design.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Desmake`,
      description,
      images: [ogImg],
    },
  };
}

export default async function ListingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const design = await resolveDesign(slug);

  let productLd: Record<string, unknown> | null = null;
  let breadcrumbLd: Record<string, unknown> | null = null;

  if (design) {
    const creator = CREATORS.find((c) => c.handle === design.creator);
    const creatorName = creator?.name ?? design.creator;
    const canonical = `${SITE_URL}/listing/${encodeURIComponent(slug)}`;
    const image = ogImageFor(design);
    const absImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;

    productLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: design.title,
      description:
        design.description ||
        `${design.aiGenerated ? "AI-generated" : "Original"} ${design.category} design, produced on demand and shipped worldwide by Desmake.`,
      image: absImage,
      category: design.category,
      brand: { "@type": "Brand", name: "Desmake" },
      sku: design.id,
      keywords: (design.tags ?? []).join(", "),
      offers: {
        "@type": "Offer",
        url: canonical,
        priceCurrency: "USD",
        price: (design.priceCents / 100).toFixed(2),
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "Desmake" },
      },
      ...(design.rating > 0 && design.reviews > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: design.rating.toFixed(1),
              reviewCount: design.reviews,
            },
          }
        : {}),
      ...(creator ? { author: { "@type": "Person", name: creatorName, url: `${SITE_URL}/creators/${creator.handle}` } } : {}),
    };

    breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Explore", item: `${SITE_URL}/explore` },
        { "@type": "ListItem", position: 3, name: design.category, item: `${SITE_URL}/explore?category=${encodeURIComponent(design.category)}` },
        { "@type": "ListItem", position: 4, name: design.title, item: canonical },
      ],
    };
  }

  return (
    <>
      {productLd && <JsonLd data={productLd} />}
      {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
      {children}
    </>
  );
}
