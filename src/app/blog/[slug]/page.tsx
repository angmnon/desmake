import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getSlugs } from "@/lib/blog";
import { Markdown } from "@/components/Markdown";

export function generateStaticParams() {
  return getSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
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
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div>
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
