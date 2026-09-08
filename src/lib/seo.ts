import type { Metadata } from "next";
import { faqSchema, SITE_URL } from "@/components/JsonLd";

export { SITE_URL };

/**
 * Centralised, consistent page metadata: sets a SELF-REFERENCING canonical
 * (relative paths resolve against the root layout's `metadataBase`), plus
 * Open Graph + Twitter cards. Using this helper everywhere prevents the old bug
 * where pages silently inherited the homepage canonical and were de-indexed.
 */
export function pageMetadata(opts: {
  path: string;
  title: string;
  description: string;
  ogType?: "website" | "article";
  ogImage?: string;
}): Metadata {
  const { path, title, description, ogType = "website", ogImage = "/og.png" } = opts;
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      siteName: "Desmake",
      locale: "en_US",
      type: ogType,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/** BreadcrumbList JSON-LD for a trail of pages (Home → … → current). */
export function breadcrumbSchema(items: { name: string; href: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.href.startsWith("http") ? it.href : `${SITE_URL}${it.href}`,
    })),
  };
}

/** BlogPosting / Article JSON-LD with author, publisher, dates and image. */
export function articleSchema(a: {
  headline: string;
  description: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
  tags?: string[];
}): Record<string, unknown> {
  const img = a.image && a.image.startsWith("http") ? a.image : `${SITE_URL}${a.image ?? "/og.png"}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.headline,
    description: a.description,
    author: { "@type": "Organization", name: a.author },
    publisher: {
      "@type": "Organization",
      name: "Desmake",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    image: img,
    mainEntityOfPage: { "@type": "WebPage", "@id": a.url },
    keywords: (a.tags ?? []).join(", "),
  };
}

/** FAQPage JSON-LD from question/answer pairs. */
export function faqJsonLd(qa: { q: string; a: string }[]): Record<string, unknown> {
  return faqSchema(qa);
}
