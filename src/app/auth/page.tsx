"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * M1 — open redirect guard.
 * `next` is attacker-controllable via the query string. A bare `startsWith("/")`
 * check still lets `//evil.com` and `/\evil.com` through, because browsers treat
 * both as protocol-relative URLs and navigate off-site. Only accept a single
 * leading slash that is not followed by another slash or a backslash.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

function AuthForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Sign in failed");
      }
      // R2/Hx: never call router.refresh() right after router.replace() — the
      // refresh re-renders the CURRENT route and can swallow the pending
      // navigation. More importantly, a client-side replace() here does NOT
      // work at all after a fresh login: while signed out, Next prefetches
      // /account (every Link target) and the proxy 307s it to /auth; that
      // redirect is cached in the router, so replace() after login bounces
      // straight back to /auth and the user appears stuck on the sign-in page
      // (button frozen) even though the login API returned 200.
      //
      // Fix: hard navigation. It carries the freshly-set session cookie to the
      // proxy guard, which then lets /account through. The account page fetches
      // its own session client-side, so no refresh() is needed either.
      setLoading(false);
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="card" style={{ padding: 24, textAlign: "left" }}>
        <div style={{ marginBottom: 14 }}>
          <label className="label small" htmlFor="auth-email">Email</label>
          <input id="auth-email" required type="email" maxLength={254} className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ borderRadius: 10 }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="label small" htmlFor="auth-name">Name <span className="faint">(optional)</span></label>
          <input id="auth-name" maxLength={120} className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Design" style={{ borderRadius: 10 }} />
        </div>
        {error && <div className="tiny" role="alert" style={{ color: "var(--color-signal)", marginBottom: 12 }}>{error}</div>}
        <button type="submit" className="btn btn-lg full center" disabled={loading}>
          {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in…</> : <>Continue <ArrowRight size={18} strokeWidth={1.8} /></>}
        </button>
      </form>

      <p className="tiny muted center mt-4">
        By continuing you agree to Desmake&apos;s Terms. <Link href="/" className="link-u small">Back to home</Link>
      </p>
    </>
  );
}

export default function AuthPage() {
  return (
    <section className="section" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
      <div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px", maxWidth: 460 }}>
        <span className="eyebrow eyebrow-dot">Account</span>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>Sign in</h1>
        <p className="lead muted" style={{ margin: "12px auto 28px", maxWidth: 340 }}>
          This is a demo marketplace. Enter any email to create a session — it&apos;s used to scope your orders and generations.
        </p>

        {/* C2: useSearchParams() opts the subtree into CSR bailout. Without a Suspense
            boundary `next build` fails the prerender of /auth outright. */}
        <Suspense fallback={<div className="card" style={{ padding: 24, minHeight: 240 }} aria-busy="true" />}>
          <AuthForm />
        </Suspense>
      </div>
    </section>
  );
}
