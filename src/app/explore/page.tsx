"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { CATEGORIES, DESIGNS, ADAPTERS, type Design } from "@/lib/data";
import { DesignCard } from "@/components/DesignCard";

const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "new", label: "Newest" },
  { id: "price_asc", label: "Price: Low → High" },
  { id: "price_desc", label: "Price: High → Low" },
];

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeAdapter, setActiveAdapter] = useState<string | null>(null);
  const [sort, setSort] = useState("trending");
  const [query, setQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  // Designs published from Studio (AI + uploaded) — merged into the grid so they
  // are browsable and searchable alongside the static seed catalog.
  const [published, setPublished] = useState<Design[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explore")
      .then((r) => r.json())
      .then((d: { designs?: Design[] }) => { if (!cancelled && Array.isArray(d.designs)) setPublished(d.designs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const seen = new Set<string>();
    let list: Design[] = [];
    // Static seed first, then published (no duplicates by slug).
    for (const d of [...DESIGNS, ...published]) {
      if (seen.has(d.slug)) continue;
      seen.add(d.slug);
      list.push(d);
    }
    if (activeCategory !== "all") list = list.filter((d) => d.category === activeCategory);
    if (activeAdapter) list = list.filter((d) => d.adapters.includes(activeAdapter));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q) || d.creator.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q)));
    }
    if (priceMin) list = list.filter((d) => d.priceCents >= parseInt(priceMin) * 100);
    if (priceMax) list = list.filter((d) => d.priceCents <= parseInt(priceMax) * 100);
    switch (sort) {
      case "new": list = [...list].reverse(); break;
      case "price_asc": list = [...list].sort((a, b) => a.priceCents - b.priceCents); break;
      case "price_desc": list = [...list].sort((a, b) => b.priceCents - a.priceCents); break;
      default: list = [...list].sort((a, b) => b.likes - a.likes);
    }
    return list;
  }, [activeCategory, activeAdapter, sort, query, priceMin, priceMax, published]);

  return (
    <div>
      {/* Hero */}
      <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,64px)" }}>
        <div className="container-wide">
          <div className="row gap-2 mb-4">
            <span className="eyebrow eyebrow-dot">Marketplace</span>
          </div>
          <h1 className="display balance">Every design,<br /><span className="serif-i">ready to make.</span></h1>
          <p className="lead" style={{ maxWidth: 520, marginTop: 18 }}>Browse thousands of designs produced on demand by our global manufacturing network.</p>

          {/* Search bar */}
          <div className="row gap-3 wrap" style={{ marginTop: 32 }}>
            <div style={{ position: "relative", flex: "1 1 360px", maxWidth: 560 }}>
              <Search size={18} style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-tx-3)" }} strokeWidth={1.8} />
              <input
                className="input"
                style={{ paddingLeft: 48, paddingRight: 16, height: 52, borderRadius: 999 }}
                placeholder="Search designs, creators, tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-outline" style={{ height: 52 }}>
              <SlidersHorizontal size={16} strokeWidth={1.8} /> Filters
            </button>
          </div>
        </div>
      </section>

      {/* Categories chips */}
      <section style={{ paddingBottom: 24 }}>
        <div className="container-wide">
          <div className="row gap-2 wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${activeCategory === c.id ? "is-active" : ""}`}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.name} <span className="mono" style={{ fontSize: "0.6875rem", opacity: 0.7 }}>{c.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>Adapters:</span>
            <button
              className={`chip ${activeAdapter === null ? "is-active" : ""}`}
              onClick={() => setActiveAdapter(null)}
              style={{ fontSize: "0.75rem", padding: "5px 11px" }}
            >
              All products
            </button>
            {ADAPTERS.map((a) => (
              <button
                key={a.id}
                className={`chip ${activeAdapter === a.id ? "is-active" : ""}`}
                onClick={() => setActiveAdapter(a.id)}
                style={{ fontSize: "0.75rem", padding: "5px 11px" }}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="section-sm" style={{ paddingTop: 24 }}>
        <div className="container-wide">
          <div className="row-between mb-8 wrap" style={{ gap: 16 }}>
            <div className="small mono" style={{ color: "var(--color-tx-2)" }}>
              {filtered.length} designs
            </div>
            <div className="seg">
              {SORTS.map((s) => (
                <button key={s.id} className={sort === s.id ? "is-active" : ""} onClick={() => setSort(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="center" style={{ padding: "80px 20px" }}>
              <p className="lead muted">No designs match those filters.</p>
              <button className="btn mt-6" onClick={() => { setActiveCategory("all"); setActiveAdapter(null); setQuery(""); setPriceMin(""); setPriceMax(""); }}>Clear filters</button>
            </div>
          ) : (
            <div className="grid g-4">
              {filtered.map((d) => (
                <DesignCard key={d.id} design={d} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
