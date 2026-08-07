import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { CREATORS, creatorByHandle, designsByCreator, compact } from "@/lib/data";
import { DesignCard } from "@/components/DesignCard";
import { Artwork } from "@/components/Artwork";
import { JsonLd, SITE_URL } from "@/components/JsonLd";

export function generateStaticParams() {
  return CREATORS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const creator = creatorByHandle(handle);
  if (!creator) return { title: "Creator not found", robots: { index: false, follow: true } };
  const title = `${creator.name} (@${creator.handle})`;
  const description = `${creator.bio} — ${creator.works} works, ${compact(creator.followers)} followers. Shop original ${creator.role.toLowerCase()} designs by ${creator.name} from ${creator.city}, made on demand and shipped worldwide by Desmake.`;
  const canonical = `/creators/${encodeURIComponent(creator.handle)}`;
  return {
    title,
    description,
    keywords: [creator.name, creator.role, creator.city, "designer", "artist", "print on demand creator"],
    alternates: { canonical },
    openGraph: {
      title: `${title} · Desmake`,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "profile",
      images: [{ url: "/og.png", alt: creator.name }],
    },
    twitter: { card: "summary_large_image", title: `${title} · Desmake`, description, images: ["/og.png"] },
  };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = creatorByHandle(handle);
  // creatorByHandle returns undefined for unknown handles. notFound() returns `never`,
  // which narrows `creator` to Creator for the rest of the render.
  if (!creator) notFound();

  const works = designsByCreator(creator.handle);

  const personLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: creator.name,
    alternateName: `@${creator.handle}`,
    url: `${SITE_URL}/creators/${creator.handle}`,
    jobTitle: creator.role,
    description: creator.bio,
    homeLocation: { "@type": "Place", name: creator.city },
    mainEntityOfPage: `${SITE_URL}/creators/${creator.handle}`,
  };

  return (
    <div>
      <JsonLd data={personLd} />
      <section style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
        <div className="container-wide">
          <div className="row gap-5 wrap" style={{ alignItems: "flex-end" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(12,12,13,0.12)", flexShrink: 0 }}>
              <Artwork seed={creator.handle} palette={["#0c0c0d", "#f7f6f3", "#f1efea"]} shape={creator.avatarHue % 6} rounded={false} className="!rounded-none" />
            </div>
            <div>
              <div className="row gap-2">
                <h1 className="h1 balance">{creator.name}</h1>
                {creator.verified && <BadgeCheck size={24} style={{ color: "var(--color-cobalt)", marginTop: 8 }} />}
              </div>
              <div className="row gap-2 small mono" style={{ color: "var(--color-tx-3)", marginTop: 4 }}>
                <span>@{creator.handle}</span><span>·</span><span>{creator.city}</span><span>·</span><span>{creator.role}</span>
              </div>
            </div>
          </div>
          <p className="lead muted" style={{ maxWidth: "60ch", margin: "20px 0 28px" }}>{creator.bio}</p>
          <div className="grid g-4" style={{ gridTemplateColumns: "repeat(4,1fr)", maxWidth: 560 }}>
            {[
              { k: "Followers", v: compact(creator.followers) },
              { k: "Sales", v: compact(creator.sales) },
              { k: "Works", v: String(creator.works) },
              { k: "Rating", v: creator.rating.toFixed(1) },
            ].map((s) => (
              <div key={s.k} className="card" style={{ padding: "18px 20px" }}>
                <div className="display mono" style={{ fontSize: "clamp(24px,3vw,34px)", lineHeight: 1 }}>{s.v}</div>
                <div className="tiny mt-1" style={{ color: "var(--color-tx-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container-wide">
          <div className="sec-head">
            <h2 className="h2">Works</h2>
            <Link href="/explore" className="link-u small">Explore marketplace <ArrowRight size={14} /></Link>
          </div>
          {works.length > 0 ? (
            <div className="grid g-4">
              {works.map((d) => <DesignCard key={d.id} design={d} />)}
            </div>
          ) : (
            <p className="small muted">No public works yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
