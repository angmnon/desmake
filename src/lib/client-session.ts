"use client";

/**
 * Ensure the visitor has a logged-in session before calling a protected API.
 *
 * Accounts now require a password and are persisted server-side. This helper no
 * longer auto-provisions guest identities or magic sign-ins — if there is no valid
 * session cookie it returns false and the caller redirects to /auth.
 */
export async function ensureSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.user);
  } catch {
    return false;
  }
}
