import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCmsPostBySlug } from "@/lib/cms";
import { Markdown } from "@/components/Markdown";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import { articleSchema, breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCmsPostBySlug("news", slug);
  if (!post) return {};
  return pageMetadata({
    path: `/news/${slug}`,
    title: post.title,
    description: post.excerpt,
    ogType: "article",
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getCmsPostBySlug("news", slug);
  if (!post) notFound();

  const url = `${SITE_URL}/news/${slug}`;
  const articleLd = articleSchema({
    headline: post.title,
    description: post.excerpt,
    author: post.author,
    datePublished: new Date(post.published_at).toISOString(),
    url,
    tags: post.tags,
  });
  const crumbLd = breadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "News", href: "/news" },
    { name: post.title, href: `/news/${slug}` },
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
          <Link href="/news" className="link-u small">
            &larr; All updates
          </Link>
          {post.tags[0] ? (
            <div className="eyebrow eyebrow-dot" style={{ marginTop: 22 }}>
              {post.tags[0]}
            </div>
          ) : null}
          <h1
            className="display balance"
            style={{ marginTop: 14, marginBottom: 16, fontSize: "clamp(1.9rem,4vw,2.8rem)" }}
          >
            {post.title}
          </h1>
          <p className="lead balance" style={{ maxWidth: "58ch", color: "var(--color-tx-2)" }}>
            {post.excerpt}
          </p>
          <p className="tiny mono faint" style={{ marginTop: 18 }}>
            {formatDate(post.published_at)} · {post.author}
          </p>
        </div>
      </section>

      <article className="section-sm" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
        <div className="container-narrow">
          <Markdown source={post.body_md} />
        </div>
      </article>
    </div>
  );
}
