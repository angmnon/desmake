import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/studio",
        "/account",
        "/cart",
        "/checkout",
        "/auth",
        "/cdn/",
        "/orders",
      ],
    },
    sitemap: "https://desmake.com/sitemap.xml",
    host: "https://desmake.com",
  };
}
