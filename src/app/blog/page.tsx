import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, playbooks and field notes on AI-native design-to-manufacture, agent commerce and selling art without inventory — from the Desmake team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "The Desmake Blog",
    description:
      "How to turn AI art into physical products, build agent storefronts, and route orders to the best factory — without inventory or spreadsheets.",
    url: "https://desmake.com/blog",
  },
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <div>
      <section
        className="section grain"
        style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(36px,4vw,64px)" }}
      >
        <div className="container-narrow" style={{ position: "relative" }}>
          <div className="eyebrow eyebrow-dot">Blog</div>
          <h1 className="display balance" style={{ marginTop: 18, marginBottom: 18 }}>
            Guides &amp; playbooks for AI-native selling
          </h1>
          <p className="lead balance" style={{ maxWidth: "56ch" }}>
            How to turn AI art into physical products, build agent storefronts, and route orders to the best factory —
            without inventory or spreadsheets.
          </p>
        </div>
      </section>

      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-narrow">
          <div className="grid g-2">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
                <span className="badge badge-outline" style={{ fontSize: "0.625rem" }}>
                  {p.tags[0]}
                </span>
                <div className="blog-card-title">{p.title}</div>
                <div className="blog-card-excerpt">{p.excerpt}</div>
                <div className="blog-card-meta">
                  {formatDate(p.date)} · {p.readingMinutes} min read
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
