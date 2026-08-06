"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const LINK_STYLE: CSSProperties = { color: "rgba(247,246,243,0.72)", transition: "color 0.2s" };

/**
 * `null` href = the destination does not exist in this build. It renders as a
 * non-interactive label rather than a dead `href="#"` link. Give it a real path
 * the moment the route ships.
 */
type FooterItem = readonly [label: string, href: string | null];

const COLUMNS: readonly { h: string; items: readonly FooterItem[] }[] = [
  { h: "Product", items: [["Explore", "/explore"], ["Studio", "/studio"], ["Creators", "/creators"], ["Agents", "/agents"]] },
  { h: "Manufacturing", items: [["Adapters", "/explore"], ["Pricing", "/pricing"], ["Shipping", "/shipping"], ["Quality", "/quality"]] },
  { h: "Creators", items: [["Become a creator", "/creators"], ["Payouts", "/payouts"], ["Guidelines", "/guidelines"], ["Dashboard", "/account"]] },
  { h: "Company", items: [["About", "/about"], ["Docs", "/docs"], ["API", "/agents"], ["Contact", "/contact"]] },
];

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--color-ink)", color: "#f7f6f3", paddingTop: "clamp(48px, 6vw, 80px)", paddingBottom: 40 }}>
      <div className="container-wide">
        <div className="grid" style={{ gridTemplateColumns: "1.4fr repeat(4, minmax(0, 1fr))", gap: "clamp(28px, 4vw, 64px)" }}>
          <div>
            <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="26" height="26" rx="6" stroke="#f7f6f3" strokeWidth="2"/>
                <path d="M3 13c5-1.5 8-1 11 2s6 4 12 3" stroke="#ff4d18" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="23.5" cy="8.5" r="2.5" fill="#ff4d18"/>
              </svg>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>Desmake</span>
            </div>
            <p className="small" style={{ color: "rgba(247,246,243,0.5)", maxWidth: "30ch", lineHeight: 1.65 }}>
              Design once. Manufacture anywhere. The AI-native marketplace connecting creators with a global on-demand manufacturing network.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.h}>
              <div className="mono" style={{ fontSize: "0.6875rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(247,246,243,0.4)", marginBottom: 18 }}>
                {col.h}
              </div>
              <ul className="stack gap-2.5">
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    {href === null ? (
                      <span className="small dm-inactive" style={LINK_STYLE}>{label}</span>
                    ) : (
                      <Link href={href} className="small dm-footer-link" style={LINK_STYLE}>
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(247,246,243,0.1)", margin: "clamp(40px,5vw,64px) 0 28px" }} />

        <div className="row-between wrap gap-4">
          <div className="tiny mono" style={{ color: "rgba(247,246,243,0.4)" }}>
            © 2026 Desmake, Inc. — Designed for makers. Manufactured worldwide.
          </div>
          <div className="row gap-5 tiny mono" style={{ color: "rgba(247,246,243,0.4)" }}>
            <Link href="/privacy" className="dm-footer-link" style={{ color: "rgba(247,246,243,0.4)" }}>Privacy</Link>
            <Link href="/terms" className="dm-footer-link" style={{ color: "rgba(247,246,243,0.4)" }}>Terms</Link>
            <Link href="/cookies" className="dm-footer-link" style={{ color: "rgba(247,246,243,0.4)" }}>Cookies</Link>
            <span>v0.1.0-mvp</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
