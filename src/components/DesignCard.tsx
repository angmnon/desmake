"use client";

import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { Artwork } from "./Artwork";
import type { Design } from "@/lib/data";
import { adapterName, compact, money, creatorByHandle } from "@/lib/data";
import { BadgeCheck } from "lucide-react";

export function DesignCard({ design }: { design: Design }) {
  // creatorByHandle may legitimately return undefined — fall back to the raw
  // handle instead of silently rendering an unrelated creator (R2/H6).
  const creator = creatorByHandle(design.creator);
  const creatorLabel = creator?.name ?? design.creator;
  return (
    <Link href={`/listing/${design.slug}`} className="block group">
      <div className="card card-hover">
        <div className="art-canvas" style={{ aspectRatio: "1", position: "relative" }}>
          <Artwork seed={design.seed} palette={design.palette} shape={design.shape} rounded={false} className="!rounded-none" />
          <div className="absolute top-3 left-3 flex gap-2">
            {design.isNew && <span className="badge" style={{ background: "#fff", color: "#0c0c0d", fontSize: "0.625rem", padding: "3px 9px" }}>NEW</span>}
            {design.aiGenerated && (
              <span className="badge" style={{ background: "rgba(12,12,13,0.7)", color: "#fff", fontSize: "0.625rem", padding: "3px 9px", backdropFilter: "blur(8px)" }}>
                <Sparkles size={10} /> AI
              </span>
            )}
          </div>
          <button
            onClick={(e) => e.preventDefault()}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur hover:bg-white hover:scale-105"
            aria-label="Like"
          >
            <Heart size={15} strokeWidth={1.8} />
          </button>
        </div>
        <div className="p-4">
          <div className="row-between mb-1.5">
            <h3 className="h5 truncate">{design.title}</h3>
            <span className="h5" style={{ fontVariantNumeric: "tabular-nums" }}>{money(design.priceCents)}</span>
          </div>
          <div className="row-between small">
            <span className="faint row gap-1">
              by <span className="text-tx font-medium">{creatorLabel}</span>
              {creator?.verified && <BadgeCheck size={12} className="inline -mt-0.5" style={{ color: "var(--color-cobalt)" }} />}
            </span>
            <span className="faint mono">
              <Heart size={11} className="inline -mt-0.5 mr-1" />
              {compact(design.likes)}
            </span>
          </div>
          <div className="row gap-1 mt-2">
            {design.adapters.slice(0, 3).map((aid) => (
              <span key={aid} className="tiny mono" style={{ padding: "2px 7px", border: "1px solid rgba(12,12,13,0.1)", borderRadius: 6, color: "var(--color-tx-3)" }}>
                {adapterName(aid)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CreatorCard({ creator }: { creator: { handle: string; name: string; city: string; role: string; verified: boolean; followers: number; works: number; avatarHue: number; bio: string } }) {
  return (
    <Link href={`/creators/${creator.handle}`} className="creator-card card card-hover block">
      <div className="cc-strip" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "rgba(12,12,13,0.1)" }}>
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
              color: "#fff", fontWeight: 600, fontSize: 16,
            }}
          >
            {creator.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="row gap-1.5">
              <span className="h5 truncate">{creator.name}</span>
              {creator.verified && <BadgeCheck size={15} style={{ color: "var(--color-cobalt)", flexShrink: 0 }} />}
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
