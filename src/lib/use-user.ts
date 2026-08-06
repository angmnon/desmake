"use client";

import { useEffect, useState } from "react";

export type SessionUserLite = { id: string; email: string; name: string; role: string };

/**
 * Reads the current session on mount and whenever the window regains focus,
 * so the header and protected pages reflect sign-in / sign-out immediately
 * after the user returns from /auth.
 */
export function useUser() {
  const [user, setUser] = useState<SessionUserLite | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/auth/session", { headers: { Accept: "application/json" } })
        .then((r) => r.json())
        .then((d) => {
          if (active) setUser(d.user || null);
        })
        .catch(() => {
          if (active) setUser(null);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { user, loaded };
}
