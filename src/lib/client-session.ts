"use client";

/**
 * Ensure a session cookie exists before calling a protected API.
 *
 * The marketplace is browsable anonymously; writes (orders, generation) need an
 * identity. When the visitor has not signed in we provision a *unique* guest
 * identity per browser.
 *
 * R2/C5: this used to POST /api/auth/login with a hard-coded `demo@desmake.app`.
 * Since accounts are keyed by email, that gave every visitor on the deployment the
 * same `user.id`, and the per-user order filter silently became a no-op — anyone
 * could read anyone else's orders and shipping details.
 */
export async function ensureSession(email?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.user) return true;
    }

    // A real email was supplied (e.g. the checkout form) — bind the session to it.
    if (email) {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (loginRes.ok) return true;
      // Fall through to a guest identity rather than blocking the flow.
    }

    const guestRes = await fetch("/api/auth/guest", { method: "POST" });
    return guestRes.ok;
  } catch {
    return false;
  }
}
