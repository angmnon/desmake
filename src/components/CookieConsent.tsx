"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent } from "@/lib/consent";

/**
 * GDPR-style consent banner. Shown only until the visitor makes a choice.
 * Accepting consent lets the Analytics component load GA4 / Meta Pixel /
 * Google Ads. Declining keeps the site fully functional but loads no
 * third-party trackers.
 */
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (readConsent() === "unset") setShow(true);
  }, []);

  if (!show) return null;

  const deny = () => {
    writeConsent("denied");
    setShow(false);
  };
  const accept = () => {
    writeConsent("granted");
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "rgba(12,12,13,0.94)",
        color: "#f7f6f3",
        padding: "16px 20px",
        display: "flex",
        gap: 16,
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <span style={{ maxWidth: 680 }}>
        We use cookies to measure marketing performance — so we can attribute
        sales to the ads you clicked — and to remember your preferences. No
        tracking or attribution cookies are set until you accept; declining
        leaves the site fully functional.
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={deny}
          style={{
            background: "transparent",
            border: "1px solid rgba(247,246,243,0.4)",
            color: "#f7f6f3",
            padding: "8px 16px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            background: "#f7f6f3",
            border: "none",
            color: "#0c0c0d",
            padding: "8px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
