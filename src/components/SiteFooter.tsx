"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const LINK_STYLE: CSSProperties = { color: "var(--tx-inv-2)", transition: "color 0.2s" };

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
    <footer className="foot">
      <div className="container-wide">
        <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-8 lg:gap-12">
          <div>
            <div className="row gap-2.5" style={{ marginBottom: 18 }}>
              <img src="/logo.svg" width={28} height={28} alt="Desmake" />
              <span style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.03em" }}>Desmake</span>
            </div>
            <p className="small" style={{ color: "var(--tx-inv-2)", maxWidth: "32ch", lineHeight: 1.65 }}>
              Design once. Manufacture anywhere. The AI-native marketplace connecting creators with a global on-demand manufacturing network.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.h}>
              <div className="foot-col-t">{col.h}</div>
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

        <div className="foot-word" aria-hidden="true">Desmake</div>

        <div className="row-between wrap gap-4" style={{ marginTop: 8 }}>
          <div className="tiny mono" style={{ color: "var(--tx-inv-3)", letterSpacing: "0.15em" }}>
            © 2026 Desmake, Inc. — Designed for makers. Manufactured worldwide.
          </div>
          <div className="row gap-5 tiny mono" style={{ color: "var(--tx-inv-3)", letterSpacing: "0.15em" }}>
            <Link href="/privacy" className="dm-footer-link" style={{ color: "var(--tx-inv-3)" }}>Privacy</Link>
            <Link href="/terms" className="dm-footer-link" style={{ color: "var(--tx-inv-3)" }}>Terms</Link>
            <Link href="/refund-policy" className="dm-footer-link" style={{ color: "var(--tx-inv-3)" }}>Refund Policy</Link>
            <Link href="/cookies" className="dm-footer-link" style={{ color: "var(--tx-inv-3)" }}>Cookies</Link>
            <span>v0.1.0-mvp</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
