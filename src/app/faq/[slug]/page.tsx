import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  const post = await getCmsPostBySlug("faq", slug);
  if (!post) return {};
  return pageMetadata({
    path: `/faq/${slug}`,
    title: post.title,
    description: post.excerpt,
    ogType: "article",
  });
}

export default async function FaqPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getCmsPostBySlug("faq", slug);
  if (!post) notFound();

  const url = `${SITE_URL}/faq/${slug}`;
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
    { name: "FAQ", href: "/faq" },
    { name: post.title, href: `/faq/${slug}` },
  ]);
  const faqLd = faqJsonLd([{ q: post.title, a: post.excerpt }]);

  return (
    <div>
      <JsonLd data={articleLd} />
      <JsonLd data={crumbLd} />
      <JsonLd data={faqLd} />
      <section
        className="section grain"
        style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(28px,3vw,44px)" }}
      >
        <div className="container-narrow" style={{ position: "relative" }}>
          <Link href="/faq" className="link-u small">
            &larr; All questions
          </Link>
          <h1
            className="display balance"
            style={{ marginTop: 18, marginBottom: 16, fontSize: "clamp(1.7rem,3.6vw,2.6rem)" }}
          >
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="lead balance" style={{ maxWidth: "58ch", color: "var(--color-tx-2)" }}>
              {post.excerpt}
            </p>
          ) : null}
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
