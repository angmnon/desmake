"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Sparkles } from "lucide-react";
import { Artwork } from "./Artwork";
import type { Design } from "@/lib/data";
import { adapterName, compact, money, creatorByHandle } from "@/lib/data";
import { BadgeCheck } from "lucide-react";

// Memoized so a parent re-render (filter change, etc.) doesn't re-render every
// card in the grid. `priority` marks above-the-fold cards for preload (LCP).
export const DesignCard = memo(function DesignCard({ design, priority = false }: { design: Design; priority?: boolean }) {
  // If the real raster fails to load (expired/blocked host), fall back to the
  // deterministic Artwork so a broken-image icon never reaches the grid.
  const [imgError, setImgError] = useState(false);
  // Prefer the explicit creator identity set on real (Studio-published) designs;
  // fall back to the static seed lookup for catalog designs whose `creator` is a
  // handle in the CREATORS seed (R2/H6: never silently render an unrelated creator).
  const creator = creatorByHandle(design.creator);
  const creatorLabel = design.creatorDisplayName ?? creator?.name ?? design.creator;
  const creatorVerified = design.creatorVerified ?? creator?.verified ?? false;
  // Link uses the DEFAULT (auto) prefetch on purpose: /listing/[slug] is dynamic and
  // has a loading.tsx boundary, so Next prefetches only the cheap static shell when a
  // card scrolls into view — clicking paints the skeleton instantly. prefetch={true}
  // would instead fire a full server render for every visible card in the grid.
  return (
    <Link href={`/listing/${design.slug}`} className="block group">
      <div className="card card-hover">
        <div className="art-canvas" style={{ aspectRatio: "1", position: "relative" }}>
          {design.imageUrl && !imgError ? (
            <Image
              src={design.imageUrl}
              alt={design.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              decoding="async"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
              style={{ position: "absolute", inset: 0 }}
            />
          ) : (
            <Artwork seed={design.seed} palette={design.palette} shape={design.shape} rounded={false} className="!rounded-none" />
          )}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
            {design.isNew && (
              <span className="badge" style={{ background: "var(--color-ink)", color: "#fff", fontSize: "0.625rem", padding: "3px 9px" }}>NEW</span>
            )}
            {design.aiGenerated && (
              <span className="badge" style={{ background: "rgba(21,23,26,0.85)", color: "#fff", fontSize: "0.625rem", padding: "3px 9px" }}>
                <Sparkles size={10} /> AI
              </span>
            )}
            {!design.aiGenerated && design.imageUrl && (
              <span className="badge" style={{ background: "rgba(21,23,26,0.85)", color: "#fff", fontSize: "0.625rem", padding: "3px 9px" }}>
                Uploaded
              </span>
            )}
            <button
              onClick={(e) => e.preventDefault()}
              className="w-8 h-8 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur hover:bg-white"
              aria-label="Like"
            >
              <Heart size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="row-between mb-1.5">
            <h3 className="h5 truncate">{design.title}</h3>
            <span className="h5" style={{ fontVariantNumeric: "tabular-nums" }}>{money(design.priceCents)}</span>
          </div>
          <div className="row-between small">
            <span className="faint row gap-1">
              by <span className="text-tx font-medium">{creatorLabel}</span>
              {creatorVerified && <BadgeCheck size={12} className="inline -mt-0.5" style={{ color: "var(--color-ink)" }} />}
            </span>
            <span className="faint mono">
              <Heart size={11} className="inline -mt-0.5 mr-1" />
              {compact(design.likes)}
            </span>
          </div>
          <div className="row gap-1 mt-2">
            {design.adapters.slice(0, 3).map((aid) => (
              <span key={aid} className="tiny mono" style={{ padding: "3px 8px", border: "1px solid var(--color-silver-line)", borderRadius: 1, color: "var(--color-tx-3)" }}>
                {adapterName(aid)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
});

export function CreatorCard({ creator }: { creator: { handle: string; name: string; city: string; role: string; verified: boolean; followers: number; works: number; avatarHue: number; bio: string } }) {
  return (
    <Link href={`/creators/${creator.handle}`} className="creator-card card card-hover block">
      <div className="cc-strip" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--color-silver-line)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: "1", background: `hsl(${creator.avatarHue + i * 30}, 40%, ${82 - i * 3}%)` }} />
        ))}
      </div>
      <div className="p-5">
        <div className="row gap-3 mb-3">
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: `hsl(${creator.avatarHue}, 55%, 60%)`,
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 500, fontSize: 16,
            }}
          >
            {creator.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="row gap-1.5">
              <span className="h5 truncate">{creator.name}</span>
              {creator.verified && <BadgeCheck size={15} style={{ color: "var(--color-ink)", flexShrink: 0 }} />}
            </div>
            <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{creator.city}</div>
          </div>
        </div>
        <div className="row gap-5 mt-4 tiny mono" style={{ color: "var(--color-tx-2)" }}>
          <span><b style={{ color: "var(--color-tx)", fontWeight: 600 }}>{compact(creator.followers)}</b> followers</span>
          <span><b style={{ color: "var(--color-tx)", fontWeight: 600 }}>{creator.works}</b> works</span>
        </div>
      </div>
    </Link>
  );
}
