// Cookie consent state. Consent gates all third-party analytics (GA4 / Meta /
// Google Ads) AND first-party marketing attribution capture (the dm_attrib
// cookie). Functional cookies (session, the dm_ref referral cookie) are not
// gated — they are needed to operate the account and pay referral commissions.

export type Consent = "granted" | "denied" | "unset";
export const CONSENT_COOKIE = "dm_consent";
/** Bump when the cookie/privacy policy materially changes — recorded with each decision. */
export const CONSENT_POLICY_VERSION = "2026-09";

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
  // R2-M-6: record the decision server-side (timestamp + policy version) so we
  // can prove consent was obtained. Fire-and-forget: never block the UI on it.
  try {
    void fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: value, policyVersion: CONSENT_POLICY_VERSION }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("dm-consent-changed", { detail: value }));
}
