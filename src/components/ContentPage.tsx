import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";

/* ────────────────────────── types ────────────────────────── */

export type ContentSection =
  | { layout: "prose"; heading?: string; body: ReactNode }
  | { layout: "bullets"; heading?: string; intro?: string; items: { title: string; text: string }[] }
  | { layout: "cards"; heading?: string; intro?: string; cards: { title: string; text: string; badge?: string }[] }
  | { layout: "stats"; items: { v: string; k: string }[] };

export type ContentCta = {
  eyebrow?: string;
  title: string;
  text: string;
  label: string;
  href: string;
};

export type ContentPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string;
  sections: ContentSection[];
  cta?: ContentCta;
};

/* ────────────────────────── section renderers ────────────────────────── */

function Section({ s }: { s: ContentSection }) {
  if (s.layout === "prose") {
    return (
      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-narrow">
          {s.heading && <h2 className="h2 balance" style={{ marginBottom: 22 }}>{s.heading}</h2>}
          <div className="stack gap-4">{s.body}</div>
        </div>
      </section>
    );
  }

  if (s.layout === "bullets") {
    return (
      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-narrow">
          {s.heading && <h2 className="h2 balance" style={{ marginBottom: 14 }}>{s.heading}</h2>}
          {s.intro && <p className="lead muted" style={{ marginBottom: 36, maxWidth: "52ch" }}>{s.intro}</p>}
          <div className="grid g-2">
            {s.items.map((it) => (
              <div key={it.title} className="row-top gap-3" style={{ alignItems: "flex-start" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--color-ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <Check size={15} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="h5" style={{ marginBottom: 4 }}>{it.title}</div>
                  <p className="small muted">{it.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (s.layout === "cards") {
    return (
      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container-wide">
          {s.heading && <h2 className="h2 balance" style={{ marginBottom: 14 }}>{s.heading}</h2>}
          {s.intro && <p className="lead muted" style={{ marginBottom: 36, maxWidth: "54ch" }}>{s.intro}</p>}
          <div className="grid g-3">
            {s.cards.map((c) => (
              <div key={c.title} className="card" style={{ padding: 26 }}>
                {c.badge && <span className="badge badge-outline" style={{ fontSize: "0.625rem", marginBottom: 14 }}>{c.badge}</span>}
                <div className="h4" style={{ marginBottom: 8 }}>{c.title}</div>
                <p className="small muted">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // stats
  return (
    <section className="section-sm" style={{ paddingTop: 0 }}>
      <div className="container-narrow">
        <div className="row gap-10 wrap">
          {s.items.map((it) => (
            <div key={it.k} className="stat">
              <div className="stat-v">{it.v}</div>
              <div className="stat-k">{it.k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── page ────────────────────────── */

export function ContentPage({ eyebrow, title, intro, updated, sections, cta }: ContentPageProps) {
  return (
    <div>
      {/* Hero */}
      <section className="section grain" style={{ position: "relative", paddingTop: "clamp(56px,7vw,104px)", paddingBottom: "clamp(40px,5vw,72px)" }}>
        <div className="spot" style={{ width: 420, height: 420, background: "rgba(255,77,24,0.12)", top: -160, right: -80 }} />
        <div className="container-narrow" style={{ position: "relative" }}>
          <div className="eyebrow eyebrow-dot">{eyebrow}</div>
          <h1 className="display balance" style={{ marginTop: 18, marginBottom: 22 }}>{title}</h1>
          <p className="lead balance" style={{ maxWidth: "56ch" }}>{intro}</p>
          {updated && <p className="tiny mono faint" style={{ marginTop: 22 }}>{updated}</p>}
        </div>
      </section>

      {sections.map((s, i) => (
        <Section key={i} s={s} />
      ))}

      {cta && (
        <section className="section section-ink grain" style={{ position: "relative", overflow: "hidden" }}>
          <div className="spot" style={{ width: 460, height: 460, background: "rgba(255,77,24,0.16)", top: -180, right: -100 }} />
          <div className="container-narrow center" style={{ position: "relative" }}>
            {cta.eyebrow && <div className="eyebrow eyebrow-dot" style={{ justifyContent: "center" }}>{cta.eyebrow}</div>}
            <h2 className="h1 balance" style={{ marginTop: 16, color: "#f7f6f3" }}>{cta.title}</h2>
            <p className="lead" style={{ color: "rgba(247,246,243,0.62)", maxWidth: "46ch", margin: "16px auto 32px" }}>{cta.text}</p>
            <Link href={cta.href} className="btn btn-paper btn-lg">
              {cta.label} <span className="arw" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
