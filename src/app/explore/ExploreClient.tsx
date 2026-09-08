"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { CATEGORIES, ADAPTERS, type Design } from "@/lib/data";
import { DesignCard } from "@/components/DesignCard";

const PAGE_SIZE = 24;
// Auto-load this many pages on scroll, then require an explicit click. Same pattern
// Etsy/ASOS use: infinite scroll is great for browsing, but unbounded auto-load
// destroys the footer, the back button and low-end devices.
const AUTO_PAGES = 5;

type Props = {
  initialDesigns: Design[];
  initialTotal: number;
  initialHasMore: boolean;
  initialCounts: Record<string, number>;
  initialCategory: string;
  initialQuery: string;
  initialSort: string;
};

const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "new", label: "Newest" },
  { id: "price_asc", label: "Price: Low → High" },
  { id: "price_desc", label: "Price: High → Low" },
];

export default function ExploreClient({
  initialDesigns,
  initialTotal,
  initialHasMore,
  initialCounts,
  initialCategory,
  initialQuery,
  initialSort,
}: Props) {
  const [items, setItems] = useState<Design[]>(initialDesigns);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);
  const [adapter, setAdapter] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  // Pages loaded without a click. Reset whenever filters change.
  const [autoLoaded, setAutoLoaded] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: a slow page-2 must never overwrite the
  // fresh page-1 of a filter the user has since changed.
  const reqIdRef = useRef(0);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (targetPage: number, opts: { category: string; q: string; sort: string; adapter: string | null }) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const myReq = ++reqIdRef.current;
      setLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        category: opts.category,
        q: opts.q,
        sort: opts.sort,
      });
      if (opts.adapter) params.set("adapter", opts.adapter);
      try {
        const r = await fetch(`/api/explore?${params.toString()}`);
        if (!r.ok) return;
        const d = await r.json();
        if (myReq !== reqIdRef.current) return; // superseded
        if (targetPage === 1) {
          setItems(d.designs ?? []);
          setCounts(d.counts ?? {});
          setAutoLoaded(0);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.slug));
            return [...prev, ...(d.designs ?? []).filter((x: Design) => !seen.has(x.slug))];
          });
        }
        setTotal(d.total ?? 0);
        setHasMore(Boolean(d.hasMore));
        setPage(targetPage);
      } catch {
        /* network hiccup — the sentinel will retry on the next intersection */
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
        loadingRef.current = false;
      }
    },
    [],
  );

  const applyFilters = useCallback(
    (nextCat: string, nextQ: string, nextSort: string, nextAdapter: string | null) => {
      const qs = new URLSearchParams();
      if (nextCat !== "all") qs.set("category", nextCat);
      if (nextQ) qs.set("q", nextQ);
      if (nextSort !== "trending") qs.set("sort", nextSort);
      if (nextAdapter) qs.set("adapter", nextAdapter);
      // Keep the URL shareable/back-navigable without re-running the server component.
      router.replace(qs.toString() ? `/explore?${qs}` : "/explore", { scroll: false });
      void fetchPage(1, { category: nextCat, q: nextQ, sort: nextSort, adapter: nextAdapter });
    },
    [router, fetchPage],
  );

  const loadMore = useCallback(() => {
    void fetchPage(page + 1, { category, q: query, sort, adapter });
    setAutoLoaded((n) => n + 1);
  }, [fetchPage, page, category, query, sort, adapter]);

  // Infinite scroll against the window viewport (no nested scroll container — nested
  // scrollers break momentum scrolling, scroll restoration and the page footer).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || autoLoaded >= AUTO_PAGES) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, autoLoaded, loadMore]);

  const onSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters(category, value, sort, adapter), 300);
  };

  const showLoadMoreButton = hasMore && autoLoaded >= AUTO_PAGES;

  return (
    <div>
      {/* Hero */}
      <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,64px)" }}>
        <div className="container-wide">
          <div className="row gap-2 mb-4">
            <span className="eyebrow eyebrow-dot">Marketplace</span>
          </div>
          <h1 className="display balance">Every design,<br /><span className="serif-i">ready to make.</span></h1>
          <p className="lead" style={{ maxWidth: 520, marginTop: 18 }}>
            Browse thousands of designs produced on demand by our global manufacturing network.
          </p>
          <div className="row gap-3 wrap" style={{ marginTop: 32 }}>
            <div style={{ position: "relative", flex: "1 1 360px", maxWidth: 560 }}>
              <Search size={18} style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-tx-3)" }} strokeWidth={1.8} />
              <input
                className="input"
                style={{ paddingLeft: 48, paddingRight: 16, height: 52, borderRadius: 2 }}
                placeholder="Search designs, creators, tags…"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-outline" style={{ height: 52 }}>
              <SlidersHorizontal size={16} strokeWidth={1.8} /> Filters
            </button>
          </div>
        </div>
      </section>

      {/* Categories + adapter chips */}
      <section style={{ paddingBottom: 24 }}>
        <div className="container-wide">
          <div className="row gap-2 wrap">
            {CATEGORIES.map((c) => {
              const cnt = counts[c.id] ?? c.count;
              return (
                <button
                  key={c.id}
                  className={`chip ${category === c.id ? "is-active" : ""}`}
                  onClick={() => { setCategory(c.id); applyFilters(c.id, query, sort, adapter); }}
                >
                  {c.name}{" "}
                  <span className="mono" style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                    {(c.id === "all" ? total : cnt).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>Adapters:</span>
            <button
              className={`chip ${adapter === null ? "is-active" : ""}`}
              onClick={() => { setAdapter(null); applyFilters(category, query, sort, null); }}
              style={{ fontSize: "0.75rem", padding: "5px 11px" }}
            >
              All products
            </button>
            {ADAPTERS.map((a) => (
              <button
                key={a.id}
                className={`chip ${adapter === a.id ? "is-active" : ""}`}
                onClick={() => { setAdapter(a.id); applyFilters(category, query, sort, a.id); }}
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
              {total.toLocaleString()} designs
              {items.length < total ? ` · showing ${items.length.toLocaleString()}` : ""}
            </div>
            <div className="seg">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  className={sort === s.id ? "is-active" : ""}
                  onClick={() => { setSort(s.id); applyFilters(category, query, s.id, adapter); }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 && !loading ? (
            <div className="center" style={{ padding: "80px 20px" }}>
              <p className="lead muted">No designs match those filters.</p>
              <button
                className="btn mt-6"
                onClick={() => { setCategory("all"); setAdapter(null); setQuery(""); applyFilters("all", "", "trending", null); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid g-4">
              {items.map((d, i) => (
                // content-visibility lets the browser skip layout/paint for cards that
                // are off-screen — the win of a virtual list without the SSR blank-grid
                // and scroll-restoration problems it brings.
                <div key={d.slug} className={i < 12 ? undefined : "cv-auto"}>
                  <DesignCard design={d} priority={i < 8} />
                </div>
              ))}
            </div>
          )}

          {/* Sentinel + load state */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loading && (
            <div className="center small muted row gap-2" style={{ justifyContent: "center", padding: "32px 0" }}>
              <Loader2 size={16} className="spin" /> Loading more designs…
            </div>
          )}
          {showLoadMoreButton && !loading && (
            <div className="center" style={{ padding: "32px 0" }}>
              <button className="btn btn-outline" onClick={loadMore}>
                Load more ({(total - items.length).toLocaleString()} left)
              </button>
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <p className="center small faint" style={{ padding: "32px 0" }}>
              You&apos;ve reached the end · {items.length.toLocaleString()} designs
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
