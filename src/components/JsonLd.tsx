import React from "react";

/**
 * Renders a JSON-LD <script> for structured data (schema.org). Search engines use
 * this for rich results; AI answer engines (GEO) use it to understand and cite the
 * page. Safe to render in both server and client components.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped enough for a JSON-LD script block.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const SITE_URL = "https://desmake.com";

/** Organization schema — establishes the brand entity for Knowledge Graph / GEO. */
export const organizationSchema: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Desmake",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  description:
    "Desmake is an AI-native design-to-manufacture marketplace. Creators publish one design and Desmake produces it on demand across six manufacturing adapters, shipping from the node closest to each buyer. It exposes an MCP/API so AI agents can search, generate, publish and order products autonomously.",
  sameAs: [
    "https://github.com/desmake",
    "https://www.producthunt.com/products/desmake",
    "https://x.com/desmake",
  ],
};

/** WebSite schema with SearchAction — enables sitelinks search box + query understanding. */
export const websiteSchema: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Desmake",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/explore?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** Build a FAQPage schema from question/answer pairs. */
export function faqSchema(qa: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
