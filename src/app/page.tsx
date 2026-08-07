"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Box, Shirt, Frame, CreditCard, Smartphone, Sticker, Check } from "lucide-react";
import { ADAPTERS, CATEGORIES, CREATORS, DESIGNS, HERO_STATS } from "@/lib/data";
import { Artwork } from "@/components/Artwork";
import { CreatorCard, DesignCard } from "@/components/DesignCard";
import { JsonLd, faqSchema } from "@/components/JsonLd";

const HOME_FAQ = faqSchema([
  {
    q: "What is Desmake?",
    a: "Desmake is an AI-native design-to-manufacture marketplace. Creators generate a design with AI or upload their own, publish it once, and Desmake automatically turns it into manufacturable products — posters, t-shirts, stickers, phone cases, business cards and 3D prints — produced on demand and shipped from the manufacturing node closest to each buyer.",
  },
  {
    q: "How does Desmake work for creators?",
    a: "Publish a single design — not a product catalogue. Desmake's Design-to-Market engine analyses the artwork, matches it to manufacturing adapters, renders photoreal mockups, writes the copy and SEO tags, prices it and lists it, typically in about four minutes. There is no inventory, no minimum order and no upfront cost; creators get paid a royalty (10%–50%) when a design sells.",
  },
  {
    q: "How is Desmake different from Printful, Printify or Redbubble?",
    a: "Desmake is AI-native and agent-first. You publish one design and it is automatically adapted, mockup-rendered, copywritten, priced and listed across six manufacturing methods, then routed to the factory node with the best cost-to-door. It also exposes an MCP server and REST API so AI agents (Claude, custom GPTs, LangGraph) can search, generate, publish and order products autonomously.",
  },
  {
    q: "Can AI agents use Desmake?",
    a: "Yes. Desmake is MCP/API-first. Add the Desmake MCP server (npx -y @desmake/mcp) with a scoped API key and an agent can search the catalogue, read live manufacturing cost, generate and publish designs, place orders and track fulfilment — with per-key metering and a full audit trail.",
  },
  {
    q: "How much does Desmake cost and how do payouts work?",
    a: "Publishing is free with 0% upfront cost. Products are made on demand starting around $5 for stickers and $7 for posters. Creators earn a royalty they set between 10% and 50% on each sale, with a transparent cost breakdown on every order and payouts across 34 shipping countries.",
  },
]);

const adapterIcon: Record<string, React.ReactNode> = {
  shirt: <Shirt size={20} strokeWidth={1.5} />,
  frame: <Frame size={20} strokeWidth={1.5} />,
  card: <CreditCard size={20} strokeWidth={1.5} />,
  phone: <Smartphone size={20} strokeWidth={1.5} />,
  sticker: <Sticker size={20} strokeWidth={1.5} />,
  cube: <Box size={20} strokeWidth={1.5} />,
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Trending");
  const tabs = ["Trending", "New", "AI Picks", "Editors"];

  const trending = [...DESIGNS].sort((a, b) => b.likes - a.likes).slice(0, 8);
  const newDesigns = DESIGNS.slice(0, 8);
  const aiPicks = DESIGNS.filter((d) => d.aiGenerated).slice(0, 8);
  const editors = DESIGNS.slice(8, 16);

  const activeDesigns = activeTab === "Trending" ? trending : activeTab === "New" ? newDesigns : activeTab === "AI Picks" ? aiPicks : editors;

  // Hero floating cards selection
  const heroCards = DESIGNS.slice(0, 3);
  const featured = DESIGNS.find((d) => d.title === "Quiet Geometry") || DESIGNS[10];

  return (
    <div>
      <JsonLd data={HOME_FAQ} />
      {/* ══════════ HERO ══════════ */}
      <section className="relative grain overflow-hidden" style={{ paddingTop: "clamp(48px, 7vw, 96px)", paddingBottom: "clamp(40px, 5vw, 72px)" }}>
        <div className="spot" style={{ width: 480, height: 480, background: "rgba(255,77,24,0.14)", top: -160, right: -60 }} />
        <div className="spot" style={{ width: 420, height: 420, background: "rgba(34,68,255,0.1)", bottom: -180, left: -120 }} />
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.06fr) minmax(0, 0.94fr)", gap: "clamp(32px,5vw,72px)", alignItems: "start" }}>
          <div className="rv in">
            <div className="row gap-3 wrap" style={{ marginBottom: 26 }}>
              <span className="badge badge-outline">AI Native Design Marketplace</span>
              <span className="eyebrow row gap-2"><i className="dot dot-live" /> 2,481 items in production right now</span>
            </div>
            <h1 className="display-xl balance">
              Design once.
              <br />
              Manufacture <span className="serif-i" style={{ letterSpacing: "-0.03em" }}>anywhere</span>.
            </h1>
            <p className="lead balance" style={{ maxWidth: "46ch", marginTop: 26 }}>
              Create with AI or upload your own work. Publish a single design and Desmake turns it into manufacturable products, produced on demand and shipped from the node closest to your buyer.
            </p>
            <div className="row gap-3 wrap" style={{ marginTop: 34 }}>
              <Link href="/studio" className="btn btn-lg">Start creating <span className="arw" /></Link>
              <Link href="/explore" className="btn btn-lg btn-outline">Explore marketplace</Link>
            </div>
            <div className="row gap-10 wrap" style={{ marginTop: 52 }}>
              {HERO_STATS.map((s) => (
                <div key={s.k}>
                  <div className="stat-v tnum">{s.v}</div>
                  <div className="stat-k">{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rv in" style={{ position: "relative", height: "clamp(420px, 46vw, 580px)" }} data-d="15">
            {heroCards.map((d, i) => (
              <div
                key={d.id}
                className="absolute overflow-hidden"
                style={{
                  borderRadius: 14,
                  boxShadow: "0 4px 12px rgba(12,12,13,0.06), 0 30px 60px -24px rgba(12,12,13,0.26)",
                  width: i === 0 ? "54%" : i === 1 ? "46%" : "42%",
                  left: i === 0 ? 0 : i === 1 ? "auto" : "auto",
                  right: i === 1 ? "2%" : i === 2 ? "8%" : "auto",
                  top: i === 0 ? "6%" : i === 1 ? 0 : "auto",
                  bottom: i === 2 ? "2%" : "auto",
                  zIndex: i === 2 ? 4 : i + 2,
                  animation: `fl ${9 + i * 2}s ease-in-out infinite ${i % 2 === 1 ? "reverse" : ""}`,
                  background: "#fff",
                  border: "1px solid rgba(12,12,13,0.08)",
                }}
              >
                <Artwork seed={d.seed} palette={d.palette} shape={d.shape} rounded={false} className="!rounded-none" />
              </div>
            ))}
            <div
              style={{
                position: "absolute", left: "4%", bottom: "6%", zIndex: 5,
                background: "rgba(255,255,255,0.86)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.7)", borderRadius: 14, padding: "13px 15px",
                boxShadow: "0 4px 12px rgba(12,12,13,0.06), 0 30px 60px -24px rgba(12,12,13,0.26)",
                minWidth: 232,
              }}
            >
              <div className="row-between" style={{ marginBottom: 9 }}>
                <span className="eyebrow">Job #5521</span>
                <span className="row gap-2 mono" style={{ fontSize: "0.625rem", color: "var(--color-moss)" }}>
                  <i className="dot dot-live" />LIVE
                </span>
              </div>
              <div className="h5" style={{ marginBottom: 3 }}>Ember Field — T-Shirt ×2</div>
              <div className="tiny faint" style={{ marginBottom: 11 }}>Austin DTG Works · routed 41s ago</div>
              <div className="bar"><i style={{ width: "62%" }} /></div>
              <div className="row-between tiny faint" style={{ marginTop: 7 }}><span>Printing</span><span>Ships Aug 4</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ADAPTER STRIP ══════════ */}
      <div style={{ background: "var(--color-ink)", color: "#f7f6f3", padding: "13px 0" }}>
        <div className="marquee">
          {[0, 1].map((k) => (
            <div key={k} className="marquee-track" style={{ animationDuration: "46s" }}>
              {[...ADAPTERS, ...ADAPTERS, ...ADAPTERS].map((a, i) => (
                <span key={i} className="row gap-3 mono" style={{ fontSize: "0.6875rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  <span style={{ color: "rgba(247,246,243,0.38)" }}>{a.name}</span>
                  <b style={{ color: "#f7f6f3", fontWeight: 500 }}>· {a.method} ·</b>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ DISCOVER ══════════ */}
      <section className="section">
        <div className="container-wide">
          <div className="sec-head rv">
            <div>
              <div className="eyebrow eyebrow-dot">The marketplace</div>
              <h2 className="h1" style={{ marginTop: 14 }}>What the world is making<br />this week</h2>
            </div>
            <div className="stack gap-4" style={{ alignItems: "flex-end" }}>
              <div className="seg">
                {tabs.map((t) => (
                  <button key={t} className={t === activeTab ? "is-active" : ""} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
              </div>
              <Link href="/explore" className="link-u small">Browse all 128,400 designs <ArrowRight size={14} /></Link>
            </div>
          </div>

          <div className="row gap-2 wrap rv" style={{ marginBottom: 26 }}>
            {CATEGORIES.slice(0, 8).map((c, i) => (
              <button key={c.id} className={`chip ${i === 0 ? "is-active" : ""}`}>
                {c.name} <span className="mono" style={{ fontSize: "0.6875rem", opacity: 0.6 }}>{c.count.toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="grid g-4">
            {activeDesigns.map((d) => (
              <DesignCard key={d.id} design={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ D2M PIPELINE ══════════ */}
      <section className="section section-ink grain" style={{ position: "relative" }}>
        <div className="container-wide">
          <div className="sec-head rv">
            <div>
              <div className="eyebrow eyebrow-dot">Design-to-Market engine</div>
              <h2 className="h1" style={{ marginTop: 14, color: "#f7f6f3" }}>
                From prompt to parcel,<br /><span className="serif-i">without the busywork</span>
              </h2>
            </div>
            <p className="body pretty" style={{ color: "rgba(247,246,243,0.62)", maxWidth: "38ch" }}>
              You publish a design — not a product catalogue. D2M analyses the artwork, picks the right adapters, renders mockups, writes the copy, prices it and lists it.
            </p>
          </div>

          <div
            className="rv"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 1,
              background: "rgba(247,246,243,0.14)",
              border: "1px solid rgba(247,246,243,0.14)",
              borderRadius: 22,
              overflow: "hidden",
            }}
          >
            {[
              { n: "01 / ANALYSE", t: "Read the artwork", d: "Colour, print resolution, transparency and subject matter are scored against every adapter's production profile." },
              { n: "02 / ADAPT", t: "Match the products", d: "Six manufacturing adapters compete for the design. Each returns a production file, a cost and a lead time." },
              { n: "03 / DRESS", t: "Mockups & copy", d: "Photoreal mockups, titles, descriptions and marketplace-ready SEO tags generated in one pass." },
              { n: "04 / SHIP", t: "Live in minutes", d: "Listings go live after review. Orders route straight to the factory node with the best cost-to-door." },
            ].map((p) => (
              <div key={p.n} style={{ background: "#0c0c0d", padding: "26px 24px 30px", position: "relative" }}>
                <div className="mono" style={{ fontSize: "0.6875rem", color: "rgba(247,246,243,0.38)", letterSpacing: "0.12em" }}>{p.n}</div>
                <div className="h3" style={{ margin: "16px 0 10px", color: "#f7f6f3" }}>{p.t}</div>
                <p className="small" style={{ color: "rgba(247,246,243,0.62)" }}>{p.d}</p>
              </div>
            ))}
          </div>

          <div className="row gap-4 wrap rv" style={{ marginTop: 36 }}>
            <Link href="/studio" className="btn btn-paper btn-lg">See the publish flow <span className="arw" /></Link>
            <span className="small" style={{ color: "rgba(247,246,243,0.38)" }}>Average time from upload to live listing — 4 min 12 s</span>
          </div>
        </div>
      </section>

      {/* ══════════ FEATURED ══════════ */}
      <section className="section">
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,.85fr)", gap: "clamp(24px,4vw,56px)", alignItems: "start" }}>
          <div className="rv" style={{ position: "relative" }}>
            <div className="card" style={{ borderRadius: 22, overflow: "hidden", padding: 0 }}>
              <div style={{ aspectRatio: "4/3" }}>
                <Artwork seed={featured.seed} palette={featured.palette} shape={featured.shape} rounded={false} className="!rounded-none" />
              </div>
            </div>
            <div className="pill-glass" style={{ position: "absolute", left: 18, top: 18 }}>Featured collection</div>
          </div>
          <div className="rv" data-d="1">
            <div className="eyebrow">Collection 07 — curated by Desmake</div>
            <h2 className="h1" style={{ margin: "16px 0 18px" }}>Quiet<br /><span className="serif-i">Geometry</span></h2>
            <p className="lead" style={{ maxWidth: "40ch" }}>
              Eighteen works exploring restraint: grids, negative space and a single decisive gesture. Available as giclée posters, heavyweight tees and die-cut stickers.
            </p>
            <div className="row gap-8 wrap" style={{ margin: "32px 0" }}>
              <div className="stat"><div className="stat-v">18</div><div className="stat-k">Works</div></div>
              <div className="stat"><div className="stat-v">6</div><div className="stat-k">Creators</div></div>
              <div className="stat"><div className="stat-v">$12</div><div className="stat-k">From</div></div>
            </div>
            <Link href="/explore" className="btn">View collection <span className="arw" /></Link>
          </div>
        </div>
      </section>

      {/* ══════════ CREATORS ══════════ */}
      <section className="section section-paper2">
        <div className="container-wide">
          <div className="sec-head rv">
            <div>
              <div className="eyebrow eyebrow-dot">Popular creators</div>
              <h2 className="h1" style={{ marginTop: 14 }}>People shaping<br />the catalogue</h2>
            </div>
            <Link href="/creators" className="link-u small">All creators <ArrowRight size={14} /></Link>
          </div>
          <div className="grid g-4">
            {CREATORS.slice(0, 8).map((c) => (
              <CreatorCard key={c.handle} creator={c} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ ADAPTERS ══════════ */}
      <section className="section">
        <div className="container-wide">
          <div className="sec-head rv">
            <div>
              <div className="eyebrow eyebrow-dot">Manufacturing adapters</div>
              <h2 className="h1" style={{ marginTop: 14 }}>Six ways to make it real</h2>
            </div>
            <p className="body muted" style={{ maxWidth: 380 }}>Every design can be produced through any adapter that accepts its profile. Switch on what fits — skip the rest.</p>
          </div>
          {/* ══════════ ADAPTERS ══════════ */}
          <div className="grid g-3">
            {ADAPTERS.map((a, i) => {
              const sampleDesign = DESIGNS[i * 3] || DESIGNS[0];
              return (
                <Link key={a.id} href="/explore" className="adp block" style={{ border: "1px solid rgba(12,12,13,0.1)", borderRadius: 14, overflow: "hidden", background: "#fff", transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
                  <div style={{ background: "var(--color-paper-2)", aspectRatio: "4/3", position: "relative", overflow: "hidden" }}>
                    <Artwork seed={sampleDesign.seed} palette={sampleDesign.palette} shape={sampleDesign.shape} rounded={false} className="!rounded-none" />
                    <span className="badge" style={{ position: "absolute", top: 12, left: 12, background: "#fff", fontSize: "0.6875rem", padding: "4px 10px", fontWeight: 500 }}>{a.method}</span>
                  </div>
                  <div style={{ padding: "18px 20px 20px" }}>
                    <div className="row-between mb-2">
                      <span className="h4">{a.name}</span>
                    </div>
                    <div className="row-between">
                      <span className="small muted">Ships in {a.lead} business days</span>
                      <span className="small strong">from ${(a.retailCents / 100).toFixed(0)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ AGENT BAND / CTA ══════════ */}
      <section className="section section-ink grain agent-band" style={{ position: "relative", overflow: "hidden" }}>
        <div className="spot" style={{ width: 500, height: 500, background: "rgba(255,77,24,0.18)", top: -200, right: -100 }} />
        <div className="spot" style={{ width: 420, height: 420, background: "rgba(107,61,245,0.15)", bottom: -200, left: -100 }} />
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)", gap: "clamp(28px,4vw,64px)", alignItems: "start", position: "relative", zIndex: 2 }}>
          <div>
            <div className="eyebrow eyebrow-dot">Agent Hub</div>
            <h2 className="h1" style={{ marginTop: 16, color: "#f7f6f3" }}>
              Give your agents<br />a <span className="serif-i">factory floor</span>.
            </h2>
            <p className="lead" style={{ color: "rgba(247,246,243,0.62)", maxWidth: "42ch", marginTop: 18 }}>
              Connect Claude, a custom GPT, or your own LangGraph worker over MCP. Scoped permissions, per-key metering, and a full audit trail of every action taken on your behalf.
            </p>
            <ul className="stack gap-3" style={{ margin: "30px 0 34px" }}>
              {[
                "Search the catalogue and read live manufacturing cost",
                "Generate, publish and price designs through D2M",
                "Place orders and track jobs to the doorstep",
              ].map((t) => (
                <li key={t} className="row gap-2.5 small" style={{ color: "rgba(247,246,243,0.72)" }}>
                  <Check size={15} style={{ color: "var(--color-signal)", flexShrink: 0, marginTop: 2 }} /> {t}
                </li>
              ))}
            </ul>
            <div className="row gap-3 wrap">
              <Link href="/agents" className="btn btn-paper btn-lg">Open Agent Hub <span className="arw" /></Link>
              <Link href="/docs" className="btn btn-lg btn-outline" style={{ background: "transparent", color: "#f7f6f3", borderColor: "rgba(247,246,243,0.2)" }}>Read the docs</Link>
            </div>
          </div>
          <div>
            <div
              className="card"
              style={{
                background: "rgba(18,18,20,0.85)",
                borderColor: "rgba(247,246,243,0.12)",
                borderRadius: 14,
                overflow: "hidden",
                fontFamily: "var(--font-mono)",
              }}
            >
              <div
                style={{
                  padding: "11px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  borderBottom: "1px solid rgba(247,246,243,0.06)",
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57", display: "block" }} />
                <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E", display: "block" }} />
                <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840", display: "block" }} />
                <span className="mono" style={{ marginLeft: 8, color: "rgba(247,246,243,0.4)", fontSize: "0.6875rem" }}>
                  ~/.config/claude/mcp.json
                </span>
              </div>
              <pre className="mono" style={{ fontSize: "0.78rem", lineHeight: 1.85, color: "rgba(247,246,243,0.82)", margin: 0, padding: "18px 20px 22px", whiteSpace: "pre-wrap" }}>{`{
  "mcpServers": {
    "desmake": {
      "command": "npx",
      "args": ["-y", "@desmake/mcp"],
      "env": {
        "DESMAKE_API_KEY": "dsk_live_xxxxxxxxxxxx"
      }
    }
  }
}

# 14 tools exposed · catalog.search, design.generate,
# design.publish, orders.create, manufacturing.track …`}</pre>
            </div>
            <div className="row gap-2 wrap" style={{ marginTop: 16 }}>
              {["MCP", "REST", "Webhooks", "TypeScript SDK", "Python SDK"].map((b) => (
                <span key={b} className="badge" style={{ background: "rgba(247,246,243,0.07)", color: "rgba(247,246,243,0.75)", fontSize: "0.7rem", padding: "4px 10px" }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ CREATOR CTA ══════════ */}
      <section className="section">
        <div className="container-wide">
          <div className="card rv" style={{ padding: "clamp(32px,5vw,72px)", borderRadius: 32, position: "relative", overflow: "hidden", border: "1px solid rgba(12,12,13,0.1)" }}>
            <div className="spot" style={{ width: 420, height: 420, background: "rgba(255,77,24,0.1)", right: -120, top: -140 }} />
            <div className="row-between wrap gap-10" style={{ position: "relative", alignItems: "flex-start" }}>
              <div style={{ maxWidth: "46ch" }}>
                <div className="eyebrow eyebrow-dot">For creators</div>
                <h2 className="h1" style={{ margin: "16px 0 16px" }}>
                  Keep making.<br />We handle the <span className="serif-i">rest</span>.
                </h2>
                <p className="lead">
                  No inventory, no minimum order, no factory calls. Publish your work and get paid when it sells — transparent cost breakdown on every order.
                </p>
                <div className="row gap-3 wrap" style={{ marginTop: 30 }}>
                  <Link href="/creators" className="btn btn-lg">Become a creator <span className="arw" /></Link>
                  <Link href="/payouts" className="btn btn-lg btn-outline">See how payouts work</Link>
                </div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "28px 48px", minWidth: 280 }}>
                {[
                  { v: "$1.2M", k: "Paid to creators" },
                  { v: "0%", k: "Upfront cost" },
                  { v: "34", k: "Shipping countries" },
                  { v: "4.9", k: "Creator rating" },
                ].map((s) => (
                  <div key={s.k} className="stat">
                    <div className="stat-v">{s.v}</div>
                    <div className="stat-k">{s.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="section">
        <div className="container-narrow center">
          <h2 className="display balance" style={{ marginBottom: 22 }}>Ready to<br /><span className="serif-i">make something?</span></h2>
          <p className="lead" style={{ maxWidth: "44ch", margin: "0 auto 36px" }}>
            Start with a prompt. Bring your own file. Publish in minutes. No inventory, no minimums, no warehouse.
          </p>
          <div className="row gap-3 wrap center" style={{ justifyContent: "center" }}>
            <Link href="/studio" className="btn btn-lg"><Sparkles size={18} strokeWidth={1.8} className="mr-1" /> Start creating</Link>
            <Link href="/explore" className="btn btn-lg btn-outline">Browse the catalogue</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
