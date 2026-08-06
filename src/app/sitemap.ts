import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://desmake.com";
  const paths = [
    "",
    "/about",
    "/pricing",
    "/explore",
    "/creators",
    "/contact",
    "/privacy",
    "/terms",
    "/guidelines",
    "/docs",
    "/quality",
    "/shipping",
    "/cookies",
  ];
  const now = new Date();
  return paths.map((p) => ({
    url: base + p,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.6,
  }));
}
