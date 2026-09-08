"use client";

import { useEffect, useRef, useState } from "react";
import { readConsent } from "@/lib/consent";
import { captureAttribution, markAnalyticsReady } from "@/lib/tracking";

// Public, build-time inlined IDs. Left empty on purpose until real IDs are
// supplied in the Dockerfile — when empty, NO third-party script is loaded.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const GA_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";

/**
 * Loads GA4 / Meta Pixel / Google Ads only AFTER the visitor grants consent,
 * and only when the corresponding NEXT_PUBLIC_* ID is configured. Scripts are
 * injected imperatively (not via next/script) so we keep full control over the
 * on-load handshake that flips `__dmAnalyticsReady` and flushes buffered events.
 *
 * Also captures first-party attribution (UTM) on every load, independent of
 * consent — that cookie is first-party and used only for our own attribution.
 */
export default function Analytics() {
  const [consent, setConsent] = useState<"unset" | "granted" | "denied">("unset");
  const loadedRef = useRef(false);

  useEffect(() => {
    captureAttribution();
    setConsent(readConsent());
    const onChanged = (e: Event) =>
      setConsent((e as CustomEvent).detail as "granted" | "denied");
    window.addEventListener("dm-consent-changed", onChanged as EventListener);
    return () =>
      window.removeEventListener("dm-consent-changed", onChanged as EventListener);
  }, []);

  useEffect(() => {
    if (consent !== "granted" || loadedRef.current) return;
    loadedRef.current = true;
    if (typeof window === "undefined") return;
    const w = window as any;

    const loadGtag = (id: string) =>
      new Promise<void>((resolve) => {
        if (!id) return resolve();
        w.dataLayer = w.dataLayer || [];
        if (typeof w.gtag !== "function") {
          w.gtag = function () {
            w.dataLayer.push(arguments);
          };
        }
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        s.onload = () => {
          w.gtag("js", new Date());
          w.gtag("config", id);
          resolve();
        };
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });

    const loadMeta = () =>
      new Promise<void>((resolve) => {
        if (!META_PIXEL_ID || w.fbq) return resolve();
        /* eslint-disable */
        (function (f: any, b: any, e: any, v: any, n: any, t: any, s: any) {
          if (f.fbq) return;
          n = f.fbq = function () {
            n.callMethod
              ? n.callMethod.apply(n, arguments)
              : n.queue.push(arguments);
          };
          if (!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = !0;
          n.version = "2.0";
          n.queue = [];
          t = b.createElement(e);
          t.async = !0;
          t.src = v;
          s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        }        )(
          window,
          document,
          "script",
          "https://connect.facebook.net/en_US/fbevents.js",
          null,
          null,
          null,
        );
        /* eslint-enable */
        w.fbq("init", META_PIXEL_ID);
        w.fbq("track", "PageView");
        resolve();
      });

    (async () => {
      await loadGtag(GA4_ID);
      if (GA_ADS_ID && typeof w.gtag === "function") w.gtag("config", GA_ADS_ID);
      await loadMeta();
      markAnalyticsReady();
    })();
  }, [consent]);

  return null;
}
