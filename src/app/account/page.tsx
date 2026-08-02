"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Package } from "lucide-react";

type User = { id: string; email: string; name: string; role: string };

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  };

  if (loaded && !user) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px" }}>
        <h1 className="h2 balance">You&apos;re signed out</h1>
        <p className="lead muted" style={{ margin: "12px auto 24px" }}>Sign in to view your account, orders, and generations.</p>
        <Link href="/auth?next=/account" className="btn btn-lg">Sign in <ArrowRight size={18} strokeWidth={1.8} /></Link>
      </div></section>
    );
  }

  return (
    <section className="section-sm" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <div className="container-narrow">
        <span className="eyebrow eyebrow-dot">Account</span>
        <h1 className="h1 balance" style={{ marginTop: 14 }}>Hi, {user?.name || "there"}</h1>
        <p className="small muted" style={{ marginTop: 6 }}>{user?.email}</p>

        <div className="stack gap-3 mt-8">
          <Link href="/orders" className="card card-hover flex items-center gap-4" style={{ padding: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
            <div className="flex-1">
              <div className="h5">My orders</div>
              <div className="tiny" style={{ color: "var(--color-tx-3)" }}>Track production and deliveries</div>
            </div>
            <ArrowRight size={18} style={{ color: "var(--color-tx-3)" }} />
          </Link>

          <button onClick={signOut} className="card card-hover flex items-center gap-4 text-left" style={{ padding: 20, width: "100%" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={20} />
            </div>
            <div className="flex-1">
              <div className="h5">Sign out</div>
              <div className="tiny" style={{ color: "var(--color-tx-3)" }}>End this session</div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
