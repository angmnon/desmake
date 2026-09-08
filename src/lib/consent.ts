// Cookie consent state. Consent gates all third-party analytics (GA4 / Meta /
// Google Ads). First-party attribution capture (UTM params in the dm_attrib
// cookie) is separate and benign — it is captured regardless of consent.

export type Consent = "granted" | "denied" | "unset";
export const CONSENT_COOKIE = "dm_consent";

export function readConsent(): Consent {
  if (typeof document === "undefined") return "unset";
  const c = document.cookie
    .split("; ")
    .find((x) => x.startsWith(CONSENT_COOKIE + "="));
  const v = c?.split("=")[1] as Consent | undefined;
  if (v === "granted" || v === "denied") return v;
  // localStorage is kept in sync as a fallback for the very first read.
  try {
    const ls = localStorage.getItem(CONSENT_COOKIE) as Consent | null;
    if (ls === "granted" || ls === "denied") return ls;
  } catch {
    /* ignore */
  }
  return "unset";
}

export function writeConsent(value: "granted" | "denied"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(CONSENT_COOKIE, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("dm-consent-changed", { detail: value }));
}
