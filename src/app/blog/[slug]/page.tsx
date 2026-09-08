import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, parseFaq } from "@/lib/blog";
import { getCmsPostBySlug } from "@/lib/cms";
import { Markdown } from "@/components/Markdown";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import { articleSchema, breadcrumbSchema, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (post) {
    return {
      title: post.title,
      description: post.excerpt,
      alternates: { canonical: `/blog/${slug}` },
      openGraph: {
        title: post.title,
        description: post.excerpt,
        url: `https://desmake.com/blog/${slug}`,
        type: "article",
      },
    };
  }
  const cms = await getCmsPostBySlug("blog", slug);
  if (!cms) return {};
  return pageMetadata({
    path: `/blog/${slug}`,
    title: cms.title,
    description: cms.excerpt,
    ogType: "article",
  });
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // File-based pillar post (static marketing content).
  const post = getPost(slug);
  if (post) {
    const faq = parseFaq(post.body);
    const url = `${SITE_URL}/blog/${slug}`;
    const articleLd = articleSchema({
      headline: post.title,
      description: post.excerpt,
      author: post.author,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      url,
      tags: post.tags,
    });
    const crumbLd = breadcrumbSchema([
      { name: "Home", href: "/" },
      { name: "Blog", href: "/blog" },
      { name: post.title, href: `/blog/${slug}` },
    ]);
    return (
      <div>
        <JsonLd data={articleLd} />
        <JsonLd data={crumbLd} />
        {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}
        <section
          className="section grain"
          style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(28px,3vw,44px)" }}
        >
          <div className="container-narrow" style={{ position: "relative" }}>
            <Link href="/blog" className="link-u small">
              &larr; All posts
            </Link>
            <div className="eyebrow eyebrow-dot" style={{ marginTop: 22 }}>
              {post.tags[0]}
            </div>
            <h1 className="display balance" style={{ marginTop: 14, marginBottom: 16, fontSize: "clamp(1.9rem,4vw,2.8rem)" }}>
              {post.title}
            </h1>
            <p className="lead balance" style={{ maxWidth: "58ch", color: "var(--color-tx-2)" }}>
              {post.excerpt}
            </p>
            <p className="tiny mono faint" style={{ marginTop: 18 }}>
              {formatDate(post.date)} · {post.readingMinutes} min read · {post.author}
            </p>
          </div>
        </section>
        <article className="section-sm" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
          <div className="container-narrow">
            <Markdown source={post.body} />
            <div style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid rgba(12,12,13,0.1)" }}>
              <Link href="/studio" className="btn btn-paper btn-lg">
                Publish your first design <span className="arw" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    );
  }

  // API-published blog post (D1-backed).
  const cms = await getCmsPostBySlug("blog", slug);
  if (!cms) notFound();

  const url = `${SITE_URL}/blog/${slug}`;
  const articleLd = articleSchema({
    headline: cms.title,
    description: cms.excerpt,
    author: cms.author,
    datePublished: new Date(cms.published_at).toISOString(),
    url,
    tags: cms.tags,
  });
  const crumbLd = breadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    { name: cms.title, href: `/blog/${slug}` },
  ]);
  return (
    <div>
      <JsonLd data={articleLd} />
      <JsonLd data={crumbLd} />
      <section
        className="section grain"
        style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(28px,3vw,44px)" }}
      >
        <div className="container-narrow" style={{ position: "relative" }}>
          <Link href="/blog" className="link-u small">
            &larr; All posts
          </Link>
          {cms.tags[0] ? (
            <div className="eyebrow eyebrow-dot" style={{ marginTop: 22 }}>
              {cms.tags[0]}
            </div>
          ) : null}
          <h1 className="display balance" style={{ marginTop: 14, marginBottom: 16, fontSize: "clamp(1.9rem,4vw,2.8rem)" }}>
            {cms.title}
          </h1>
          <p className="lead balance" style={{ maxWidth: "58ch", color: "var(--color-tx-2)" }}>
            {cms.excerpt}
          </p>
          <p className="tiny mono faint" style={{ marginTop: 18 }}>
            {new Date(cms.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })} · {cms.author}
          </p>
        </div>
      </section>
      <article className="section-sm" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
        <div className="container-narrow">
          <Markdown source={cms.body_md} />
        </div>
      </article>
    </div>
  );
}
