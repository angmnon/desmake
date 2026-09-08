import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { listCmsPosts } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  path: "/blog",
  title: "Blog",
  description:
    "Guides, playbooks and field notes on AI-native design-to-manufacture, agent commerce and selling art without inventory — from the Desmake team.",
});

type Item = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  sortKey: number;
  author: string;
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogIndex() {
  const fileItems: Item[] = getAllPosts().map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    tags: p.tags,
    sortKey: Date.parse(p.date + "T00:00:00Z") || 0,
    author: p.author,
  }));

  let cmsItems: Item[] = [];
  try {
    const cms = await listCmsPosts({ type: "blog", status: "published", limit: 100 });
    cmsItems = cms.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      tags: p.tags,
      sortKey: p.published_at,
      author: p.author,
    }));
  } catch {
    // D1 unavailable — fall back to file-based posts only.
  }

  const items = [...fileItems, ...cmsItems].sort((a, b) => b.sortKey - a.sortKey);

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
            {items.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
                {p.tags[0] ? (
                  <span className="badge badge-outline" style={{ fontSize: "0.625rem" }}>
                    {p.tags[0]}
                  </span>
                ) : null}
                <div className="blog-card-title">{p.title}</div>
                <div className="blog-card-excerpt">{p.excerpt}</div>
                <div className="blog-card-meta">{p.author}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
