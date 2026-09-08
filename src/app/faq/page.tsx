import type { Metadata } from "next";
import Link from "next/link";
import { listCmsPosts } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  path: "/faq",
  title: "FAQ",
  description: "Frequently asked questions about Desmake — straight answers from the team.",
});

export default async function FaqIndex() {
  const posts = await listCmsPosts({ type: "faq", status: "published", limit: 200 });
  return (
    <div>
      <section
        className="section grain"
        style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(36px,4vw,64px)" }}
      >
        <div className="container-narrow" style={{ position: "relative" }}>
          <div className="eyebrow eyebrow-dot">FAQ</div>
          <h1 className="display balance" style={{ marginTop: 18, marginBottom: 18 }}>
            Questions &amp; answers
          </h1>
          <p className="lead balance" style={{ maxWidth: "56ch" }}>
            Straight answers to the questions creators ask us most.
          </p>
        </div>
      </section>

      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-narrow">
          {posts.length === 0 ? (
            <p className="lead balance">No questions yet — check back soon.</p>
          ) : (
            <div className="grid g-2">
              {posts.map((p) => (
                <Link key={p.id} href={`/faq/${p.slug}`} className="blog-card">
                  <div className="blog-card-title">{p.title}</div>
                  {p.excerpt ? <div className="blog-card-excerpt">{p.excerpt}</div> : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
