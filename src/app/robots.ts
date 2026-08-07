import type { MetadataRoute } from "next";

// Disable route caching: this file changes between deploys, and a stale
// edge/instance cache would otherwise serve an old robots.txt for up to a day.
export const dynamic = "force-dynamic";

const PRIVATE = ["/api/", "/studio", "/account", "/cart", "/checkout", "/auth", "/cdn/", "/orders"];

/**
 * GEO decision: we EXPLICITLY welcome AI/answer-engine crawlers so Desmake can be
 * cited by ChatGPT, Claude, Perplexity, Gemini and AI Overviews. Being an
 * MCP/agent-first product, discovery by AI assistants is a primary channel — we do
 * not block GPTBot / ClaudeBot / PerplexityBot / Google-Extended etc.
 */
export default function robots(): MetadataRoute.Robots {
  const aiBots = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "Amazonbot",
    "cohere-ai",
    "Bytespider",
    "DuckAssistBot",
    "meta-externalagent",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      // Give every named AI crawler the same open access to public content.
      ...aiBots.map((ua) => ({ userAgent: ua, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: "https://desmake.com/sitemap.xml",
    host: "https://desmake.com",
  };
}
