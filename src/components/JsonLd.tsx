import React from "react";

/**
 * Renders a JSON-LD <script> for structured data (schema.org). Search engines use
 * this for rich results; AI answer engines (GEO) use it to understand and cite the
 * page. Safe to render in both server and client components.
 */
/**
 * Serialise `data` for embedding inside a <script type="application/ld+json"> block.
 *
 * JSON.stringify alone is NOT safe here: it does not escape `<` or `/`, so any
 * user-controlled value (creator bio/name/city/role — see /api/profile) containing
 * `</script>` would close the script element early and inject attacker markup,
 * giving stored XSS. Re-encoding `<` as \u003c keeps the payload valid JSON while
 * making it impossible to terminate the tag. (H-1)
 */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
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
    // GEO entity signals — each MUST resolve to Desmake's own profile. Create/claim
    // any that are not yet owned (verified in the deploy summary); an unclaimed URL
    // is simply inert, it does not hurt ranking, but a wrong-entity one would.
    "https://www.linkedin.com/company/desmake",
    "https://www.youtube.com/@desmake",
    "https://www.reddit.com/r/desmake",
    "https://www.indiehackers.com/desmake",
    "https://www.crunchbase.com/organization/desmake",
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
