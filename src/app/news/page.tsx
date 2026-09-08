import type { Metadata } from "next";
import Link from "next/link";
import { listCmsPosts } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  path: "/news",
  title: "News & Updates",
  description:
    "Product announcements, feature drops and company news from the Desmake team — published continuously by our operations crew.",
});

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function NewsIndex() {
  const posts = await listCmsPosts({ type: "news", status: "published", limit: 100 });
  return (
    <div>
      <section
        className="section grain"
        style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(36px,4vw,64px)" }}
      >
        <div className="container-narrow" style={{ position: "relative" }}>
          <div className="eyebrow eyebrow-dot">News</div>
          <h1 className="display balance" style={{ marginTop: 18, marginBottom: 18 }}>
            News &amp; updates
          </h1>
          <p className="lead balance" style={{ maxWidth: "56ch" }}>
            Product announcements, feature drops and company news from the Desmake team.
          </p>
        </div>
      </section>

      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-narrow">
          {posts.length === 0 ? (
            <p className="lead balance">No updates yet — check back soon.</p>
          ) : (
            <div className="grid g-2">
              {posts.map((p) => (
                <Link key={p.id} href={`/news/${p.slug}`} className="blog-card">
                  {p.tags[0] ? (
                    <span className="badge badge-outline" style={{ fontSize: "0.625rem" }}>
                      {p.tags[0]}
                    </span>
                  ) : null}
                  <div className="blog-card-title">{p.title}</div>
                  <div className="blog-card-excerpt">{p.excerpt}</div>
                  <div className="blog-card-meta">
                    {formatDate(p.published_at)} · {p.author}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
