"use client";

// P1-1: the only stateful (tab-switching) part of the homepage is extracted here so
// the homepage itself can be a Server Component. This keeps the full seed catalog
// (`DESIGNS`, ~285 designs + pricing tables) server-side — it is computed on the
// server and only the 4 small pre-filtered arrays (≤8 each) cross the wire as props.
// Previously the homepage was "use client" and statically imported the entire
// `@/lib/data` module (incl. pricing.ts), shipping it to every visitor's JS bundle.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DesignCard } from "./DesignCard";
import type { Design } from "@/lib/data";

type CategoryLike = { id: string; name: string; count: number };

export default function HomeDiscover({
  trending,
  newDesigns,
  aiPicks,
  editors,
  categories,
}: {
  trending: Design[];
  newDesigns: Design[];
  aiPicks: Design[];
  editors: Design[];
  categories: CategoryLike[];
}) {
  const [activeTab, setActiveTab] = useState("Trending");
  const tabs = ["Trending", "New", "AI Picks", "Editors"];

  const activeDesigns =
    activeTab === "Trending"
      ? trending
      : activeTab === "New"
        ? newDesigns
        : activeTab === "AI Picks"
          ? aiPicks
          : editors;

  return (
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
          {categories.slice(0, 8).map((c, i) => (
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
  );
}
