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

type AuthMode = "signin" | "register";

function AuthForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Deep-linkable via ?mode=register (used by the header "Create account" button).
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "register" ? "register" : "signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // M-3: inline verification prompt after a registration that still needs email
  // confirmation. Keeps the buyer on-page instead of dropping them into a 403 at
  // the final checkout step.
  const [registered, setRegistered] = useState<{ email: string; sent: boolean; link?: string } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const isRegister = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Real accounts: registration creates a password account (new endpoint),
      // sign-in verifies the password against the persisted record.
      const res = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || (isRegister ? "Registration failed" : "Sign in failed"));
      }
      // Never call router.refresh() right after router.replace() — the refresh
      // re-renders the CURRENT route and can swallow the pending navigation.
      // More importantly, a client-side replace() does NOT work after a fresh
      // login: while signed out, Next prefetches /account (every Link target) and
      // the proxy 307s it to /auth; that redirect is cached in the router, so
      // replace() after login bounces straight back to /auth (user stuck on the
      // sign-in page) even though the login API returned 200.
      //
      // Fix: hard navigation. It carries the freshly-set session cookie to the
      // proxy guard, which then lets /account through. The account page fetches
      // its own session client-side, so no refresh() is needed either.
      if (isRegister) {
        const data = (await res.json().catch(() => ({}))) as {
          user?: { email?: string };
          verification_required?: boolean;
          verification_sent?: boolean;
          email_verification_link?: string;
        };
        // M-3: if email verification is still required, surface an inline prompt
        // rather than navigating the buyer into a dead-end 403 at checkout.
        if (data.verification_required) {
          setRegistered({
            email: data.user?.email || email,
            sent: Boolean(data.verification_sent),
            link: data.email_verification_link,
          });
          setLoading(false);
          return;
        }
      }
      setLoading(false);
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  // H-10/M-3: self-serve resend. The session cookie was just set by registration,
  // so no re-auth is needed. Works even if the first email was lost or (C-3) never
  // sent — gives the buyer a recovery path instead of a silent dead end.
  const resend = async () => {
    setResending(true);
    setResendMsg(null);
    try {
      const r = await fetch("/api/auth/resend-verification", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { delivered?: boolean; link?: string; error?: { message?: string } };
      if (!r.ok) throw new Error(d.error?.message || "Could not resend the email");
      setRegistered((p) => (p ? { ...p, sent: Boolean(d.delivered), link: d.link ?? p.link } : p));
      setResendMsg(d.delivered ? "Verification email resent — check your inbox." : "We still couldn't deliver it. Use the link below or try again shortly.");
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : "Could not resend the email");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <div className="card" style={{ padding: 24, textAlign: "left" }}>
        <div className="eyebrow eyebrow-dot">Account</div>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>
          {isRegister ? "Create your account" : "Sign in"}
        </h1>
        <p className="lead muted" style={{ margin: "12px auto 24px", maxWidth: 340 }}>
          {isRegister
            ? "Create an account to publish designs to the marketplace, track orders, and get paid when your work sells."
            : "Sign in with the email and password you registered with to manage your orders and designs."}
        </p>

        {/* M-3: when registration succeeded but email verification is still
            required, show an inline prompt (with a self-serve resend) instead of
            navigating the buyer into a 403 at checkout. */}
        {registered ? (
          <div role="status" aria-live="polite" style={{ textAlign: "left" }}>
            <div className="eyebrow eyebrow-dot" style={{ color: "var(--color-ink)" }}>Verify your email</div>
            <h2 className="h3 balance" style={{ marginTop: 10 }}>
              You're almost in — confirm your email
            </h2>
            <p className="lead muted" style={{ margin: "12px 0 18px" }}>
              We sent a verification link to <strong>{registered.email}</strong>. Open it to activate your account before you place an order.
            </p>
            {!registered.sent && (
              <div className="tiny" role="alert" style={{ color: "var(--color-ink)", marginBottom: 14, fontWeight: 500 }}>
                We couldn't deliver the email automatically. Use the link below or resend it.
              </div>
            )}
            {registered.link && (
              <a href={registered.link} className="btn btn-lg full center mb-4" style={{ textDecoration: "none" }}>
                Verify my email (dev link)
              </a>
            )}
            <button type="button" className="btn btn-lg full center" disabled={resending} onClick={resend}>
              {resending ? <><Loader2 size={18} className="animate-spin" /> Resending…</> : "Resend verification email"}
            </button>
            {resendMsg && <div className="tiny muted center mt-3">{resendMsg}</div>}
            <p className="tiny muted center mt-4">
              <button type="button" className="link-u small" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setRegistered(null); setMode("signin"); setError(null); }}>
                Back to sign in
              </button>
            </p>
          </div>
        ) : (
          <>
            {/* Mode switch: Sign in / Create account */}
            <div className="seg mb-6" style={{ width: "100%" }}>
              {(["signin", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mode === m ? "is-active" : ""}
                  onClick={() => { setMode(m); setError(null); }}
                  style={{ flex: 1 }}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <label className="label small" htmlFor="auth-email">Email</label>
                <input id="auth-email" required type="email" maxLength={254} className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ borderRadius: 10 }} />
              </div>
              {isRegister && (
                <div style={{ marginBottom: 14 }}>
                  <label className="label small" htmlFor="auth-name">Name <span className="faint">(required)</span></label>
                  <input id="auth-name" required maxLength={120} className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Design" style={{ borderRadius: 10 }} />
                </div>
              )}
              <div style={{ marginBottom: 18 }}>
                <label className="label small" htmlFor="auth-password">
                  Password {isRegister && <span className="faint">(min 6 chars)</span>}
                </label>
                <input id="auth-password" required type="password" minLength={6} maxLength={128} autoComplete={isRegister ? "new-password" : "current-password"} className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? "Create a password" : "Your password"} style={{ borderRadius: 10 }} />
              </div>
              {error && <div className="tiny" role="alert" style={{ color: "var(--color-ink)", marginBottom: 12, fontWeight: 500 }}>{error}</div>}
              <button type="submit" className="btn btn-lg full center" disabled={loading}>
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {isRegister ? "Creating account…" : "Signing in…"}</>
                ) : isRegister ? (
                  <>Create account <ArrowRight size={18} strokeWidth={1.8} /></>
                ) : (
                  <>Continue <ArrowRight size={18} strokeWidth={1.8} /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="tiny muted center mt-4">
        {isRegister ? (
          <>Already have an account? <button type="button" className="link-u small" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setMode("signin"); setError(null); }}>Sign in</button></>
        ) : (
          <>New to Desmake? <button type="button" className="link-u small" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setMode("register"); setError(null); }}>Create an account</button></>
        )}
        {" · "}<Link href="/" className="link-u small">Back to home</Link>
      </p>
    </>
  );
}

export default function AuthPage() {
  return (
    <section className="section" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
      <div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px", maxWidth: 460 }}>
        {/* C2: useSearchParams() opts the subtree into CSR bailout. Without a Suspense
            boundary `next build` fails the prerender of /auth outright. */}
        <Suspense fallback={<div className="card" style={{ padding: 24, minHeight: 240 }} aria-busy="true" />}>
          <AuthForm />
        </Suspense>
      </div>
    </section>
  );
}
