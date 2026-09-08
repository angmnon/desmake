import Link from "next/link";
import { ArrowRight, Check, Sparkles, BarChart3, DollarSign, Globe, Upload } from "lucide-react";
import { Artwork } from "@/components/Artwork";
import { DESIGNS, CREATORS, compact, type Creator, type Design } from "@/lib/data";
import { pageMetadata, breadcrumbSchema } from "@/lib/seo";
import { JsonLd, faqSchema } from "@/components/JsonLd";
import { allRealCreators, creatorViewFromUser } from "@/lib/creators";
import { allPublishedDesigns } from "@/lib/stores";
import { publishedToDesign } from "@/lib/catalog";

export const metadata = pageMetadata({
  path: "/creators",
  title: "Desmake creators — sell AI art & designs without inventory",
  description:
    "Join Desmake creators: generate or upload designs, publish once, and earn a royalty across a global on-demand manufacturing network. No inventory, no minimums.",
});

const CREATOR_FAQ = [
  {
    q: "How much does it cost to become a creator?",
    a: "Nothing. Publishing is free — no subscription, no listing fees, no inventory. You pay the real manufacturing cost only when an item sells, and keep the margin you set.",
  },
  {
    q: "How much can I earn?",
    a: "You set a royalty between 10% and 50% per sale, with a 90% revenue share available on Desmake. Payouts are transparent and paid across 34 countries.",
  },
  {
    q: "Do I need design skills?",
    a: "No. Desmake Studio generates artwork with AI, or you can upload your own. Mockups, titles and descriptions are generated for you as part of publishing.",
  },
  {
    q: "Who handles manufacturing and shipping?",
    a: "Desmake does. Your design is produced on demand at the node closest to the buyer and shipped worldwide, so you can keep creating instead of running a supply chain.",
  },
];

const BENEFITS = [
  { icon: <Sparkles size={18} strokeWidth={1.8} />, title: "AI-augmented creation", text: "Generate, remix, and iterate with our studio tools built for the AI-native creator." },
  { icon: <DollarSign size={18} strokeWidth={1.8} />, title: "90% revenue share", text: "Keep the vast majority of every sale. No hidden fees, no storage costs, no hosting bills." },
  { icon: <Globe size={18} strokeWidth={1.8} />, title: "Global manufacturing", text: "One click publishes your design to every product adapter in the network. We handle fulfillment." },
  { icon: <BarChart3 size={18} strokeWidth={1.8} />, title: "Built-in analytics", text: "Real-time sales, views, and conversion. Understand what works and double down." },
];

const STEPS = [
  { n: "01", t: "Generate or upload", d: "Use Desmake Studio to create with AI, or upload your own work as PNG/SVG." },
  { n: "02", t: "Publish once", d: "We auto-adapt your design to every product surface in the catalog — prints, apparel, tech, and more." },
  { n: "03", t: "Share & earn", d: "Share your storefront. The network routes orders and pays out weekly." },
];

export default async function CreatorsPage() {
  // M-UGC: merge real creators (who published ≥1 design) with the editorial
  // "Desmake Select" seed creators. Real wins on handle collision; sort by works.
  const realCreators: Creator[] = (await allRealCreators()).map((r) =>
    creatorViewFromUser(r.user, r.works),
  );
  const byHandle = new Map<string, Creator>();
  for (const c of [...CREATORS, ...realCreators]) {
    if (!byHandle.has(c.handle)) byHandle.set(c.handle, c);
  }
  const topCreators = Array.from(byHandle.values())
    .sort((a, b) => b.works - a.works)
    .slice(0, 8);

  // Surface real published designs first, falling back to the seed catalog.
  const published = await allPublishedDesigns();
  const topListings: Design[] =
    published.length > 0
      ? published.slice(0, 4).map(publishedToDesign)
      : DESIGNS.slice(0, 4);

  return (
    <div>
      <JsonLd data={faqSchema(CREATOR_FAQ)} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", href: "/" }, { name: "Creators", href: "/creators" }])} />
      <section style={{ paddingTop: "clamp(32px,4vw,56px)" }}>
        <div className="container-narrow center">
          <span className="eyebrow eyebrow-dot">For creators</span>
          <h1 className="display balance" style={{ marginTop: 14 }}>Design once.<br/><span className="serif-i">Manufacture</span> everywhere.</h1>
          <p className="lead" style={{ maxWidth: "48ch", margin: "20px auto 28px" }}>The marketplace that does the work for you. Create with AI, publish once, and we handle manufacturing, fulfillment, and payments across a global network of producers.</p>
          <div className="row gap-3 center" style={{ justifyContent: "center" }}>
            <Link href="/studio" className="btn btn-lg">Start creating <Upload size={18} strokeWidth={1.8} /></Link>
            <Link href="/explore" className="btn btn-lg btn-outline">Explore marketplace</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="grid g-4" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {[
              { n: "12k+", l: "Creators" },
              { n: "$3.2M", l: "Paid out" },
              { n: "86", l: "Countries" },
              { n: "90%", l: "Your share" },
            ].map((s) => (
              <div key={s.l} className="card" style={{ padding: "28px 24px" }}>
                <div className="display mono" style={{ fontSize: "clamp(32px,4vw,48px)", lineHeight: 1 }}>{s.n}</div>
                <div className="small mt-2" style={{ color: "var(--color-tx-2)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-sm">
        <div className="container-wide">
          <div style={{ maxWidth: 520, marginBottom: 40 }}>
            <span className="eyebrow">Why Desmake</span>
            <h2 className="h2 mt-3">Built for the <span className="serif-i">new creator.</span></h2>
          </div>
          <div className="grid g-3" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {BENEFITS.map((b) => (
              <div key={b.title} className="card" style={{ padding: 28 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: "var(--color-ink)" }}>
                  {b.icon}
                </div>
                <h3 className="h4 mb-2">{b.title}</h3>
                <p className="small muted">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="row-between mb-8">
            <div>
              <span className="eyebrow">How it works</span>
              <h2 className="h2 mt-3">Three steps to your first sale.</h2>
            </div>
          </div>
          <div className="grid g-3" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {STEPS.map((s) => (
              <div key={s.n} className="card" style={{ padding: 32 }}>
                <div className="tiny mono" style={{ color: "var(--color-tx-3)", marginBottom: 20 }}>{s.n}</div>
                <h3 className="h4 mb-2">{s.t}</h3>
                <p className="small muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top creators */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="row-between mb-8">
            <div>
              <span className="eyebrow">Top creators</span>
              <h2 className="h2 mt-3">Earning on Desmake.</h2>
            </div>
            <Link href="/explore" className="link-u mono small">Browse all</Link>
          </div>
          <div className="grid g-3" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {topCreators.slice(0, 4).map((c) => (
              <Link key={c.handle} href={`/creators/${c.handle}`} className="card card-hover block" style={{ padding: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", marginBottom: 16, border: "1px solid rgba(12,12,13,0.1)" }}>
                  <Artwork seed={c.handle} palette={["#0c0c0d", "#f7f6f3", "#f1efea"]} shape={c.avatarHue % 6} rounded={false} className="!rounded-none" />
                </div>
                <h4 className="h5">{c.name}</h4>
                <div className="tiny mono mb-3" style={{ color: "var(--color-tx-3)" }}>@{c.handle}</div>
                <div className="hr" style={{ margin: "12px 0" }} />
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Works</div>
                    <div className="mono font-semibold small">{c.works}</div>
                  </div>
                  <div>
                    <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Followers</div>
                    <div className="mono font-semibold small">{compact(c.followers)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sample work */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="row-between mb-6">
            <h2 className="h2">Live on the marketplace.</h2>
            <Link href="/explore" className="link-with-arrow mono">Explore all <ArrowRight size={14} /></Link>
          </div>
          <div className="grid g-2" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {topListings.map((l) => (
              <Link href={`/listing/${l.slug}`} key={l.slug} className="card card-hover" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ aspectRatio: "1" }}>
                  <Artwork seed={l.seed} palette={l.palette} shape={l.shape} rounded={false} className="!rounded-none" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-sm">
        <div className="container-narrow">
          <h2 className="h2">Frequently asked questions</h2>
          <div className="stack gap-5" style={{ marginTop: 20 }}>
            {CREATOR_FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="h5" style={{ marginBottom: 8 }}>{f.q}</h3>
                <p className="small muted">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="card" style={{ padding: "clamp(40px,5vw,64px)", background: "var(--color-ink)", color: "#fff" }}>
            <div style={{ maxWidth: 640 }}>
              <h2 className="h2" style={{ fontSize: "clamp(32px,4vw,52px)" }}>Ready to start <span className="serif-i">selling?</span></h2>
              <p className="lead" style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, marginBottom: 28 }}>
                It takes two minutes to sign up, and you can publish your first design today. No approval queue, no inventory risk.
              </p>
              <ul className="stack gap-2 mb-7" style={{ maxWidth: 400 }}>
                {["90% revenue share, weekly payouts", "Zero upfront costs or inventory", "Access to AI creation studio", "Global manufacturing network"].map((f) => (
                  <li key={f} className="row gap-2 small">
                    <Check size={15} strokeWidth={2} style={{ color: "var(--color-ink)", flexShrink: 0, marginTop: 2 }} /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/studio" className="btn btn-lg" style={{ background: "#fff", color: "#0c0c0d", borderColor: "#fff" }}>
                Open Studio <ArrowRight size={18} strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
