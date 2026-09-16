"use client";

import { useState, type ReactNode } from "react";
import { Share2, Check, Copy, X } from "lucide-react";

type Props = {
  /** The sharing user's public handle (the person who earns the referral). */
  handle: string;
  /** Optional design slug — when present the share lands on that product and still attributes. */
  designSlug?: string;
  /** Optional SKU to deep-link, so the shared link lands with the exact product pre-selected. */
  sku?: string;
  /** Optional variant to deep-link alongside `sku`. */
  variant?: string;
  /** Human-readable title used in social copy. */
  title?: string;
  /** Label for the trigger button. */
  label?: string;
  /** Render as a compact icon button instead of a full button. */
  iconOnly?: boolean;
  /** Optional extra trigger node; when provided the default button is not rendered. */
  children?: ReactNode;
};

/**
 * Share & earn sheet. Builds the creator's attribution link (which plants the
 * dm_ref cookie via /api/ref) and offers copy + native share + social targets.
 * Any logged-in user can share any product and earn a 7% referral on resulting
 * purchases — referral attribution is by handle, not by design ownership.
 */
export function ShareSheet({ handle, designSlug, sku, variant, title, label = "Share & earn", iconOnly = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function buildLinks() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // P0: deep-link the exact product + variant so the shared link lands on a
    // ready-to-buy state (the "自带购物链接" request). sku/variant are passed as
    // TOP-LEVEL params on /api/ref (NOT nested inside `to`): a query nested inside
    // a query param gets its `&` re-split by the URL parser and the variant is lost.
    // /api/ref reconstructs the landing URL from these and plants the dm_ref cookie,
    // so referral commission still tracks.
    const toPath = designSlug ? `/listing/${encodeURIComponent(designSlug)}` : "";
    const refParams = new URLSearchParams();
    refParams.set("ref", handle);
    if (toPath) refParams.set("to", toPath);
    if (sku) refParams.set("sku", sku);
    if (variant) refParams.set("variant", variant);
    const refLink = `${origin}/api/ref?${refParams.toString()}`;
    const landingParams = new URLSearchParams();
    if (sku) landingParams.set("sku", sku);
    if (variant) landingParams.set("variant", variant);
    const landing = designSlug
      ? `${origin}/listing/${encodeURIComponent(designSlug)}` + (landingParams.toString() ? `?${landingParams.toString()}` : "")
      : `${origin}/creators/${encodeURIComponent(handle)}`;
    return { refLink, landing };
  }

  async function copy() {
    const { refLink } = buildLinks();
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  async function nativeShare() {
    const { refLink, landing } = buildLinks();
    const text = title ? `Check out "${title}" on Desmake` : "Check out Desmake";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: text, text, url: refLink });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    copy();
  }

  function socialUrl(network: string) {
    const { refLink, landing } = buildLinks();
    const text = title ? `Check out "${title}" on Desmake` : "Check out Desmake";
    const u = encodeURIComponent(landing);
    const r = encodeURIComponent(refLink);
    const t = encodeURIComponent(text);
    switch (network) {
      case "x":
        return `https://twitter.com/intent/tweet?text=${t}&url=${r}`;
      case "facebook":
        return `https://www.facebook.com/sharer/sharer.php?u=${r}`;
      case "pinterest":
        return `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`;
      case "reddit":
        return `https://www.reddit.com/submit?url=${r}&title=${t}`;
      case "whatsapp":
        return `https://wa.me/?text=${t}%20${r}`;
      case "email":
        return `mailto:?subject=${t}&body=${t}%20${r}`;
      default:
        return landing;
    }
  }

  const trigger = children ?? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={iconOnly ? "icon-btn" : "btn btn-outline"}
      aria-label={label}
    >
      {iconOnly ? <Share2 size={16} /> : (<><Share2 size={16} /> {label}</>)}
    </button>
  );

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: "inline-flex" }}>{trigger}</span>
      {open && (
        <div
          className="modal-backdrop"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(12,12,13,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: "100%", padding: 24, position: "relative" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="icon-btn"
              style={{ position: "absolute", top: 12, right: 12 }}
            >
              <X size={18} />
            </button>
            <h3 className="h4 mb-1">Share & earn</h3>
            <p className="small muted mb-4">
              Share this link. When someone buys through it, you earn a <b>7% referral commission</b> — tracked for 30 days.
            </p>

            <label className="tiny mono" style={{ color: "var(--color-tx-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Your share link</label>
            <div className="row gap-2 mt-1" style={{ alignItems: "stretch" }}>
              <input
                readOnly
                value={typeof window !== "undefined" ? buildLinks().refLink : ""}
                onFocus={(e) => e.currentTarget.select()}
                className="input"
                style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
              />
              <button type="button" className="btn" onClick={copy}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>

            <div className="row gap-2 mt-4 wrap">
              <button type="button" className="btn btn-outline" onClick={nativeShare}><Share2 size={15} /> Share…</button>
              {["x", "facebook", "pinterest", "reddit", "whatsapp", "email"].map((n) => (
                <a
                  key={n}
                  href={socialUrl(n)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ textTransform: "capitalize" }}
                >
                  {n === "x" ? "X" : n}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
