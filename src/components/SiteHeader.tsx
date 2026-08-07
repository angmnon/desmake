"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Bell, ShoppingBag, Menu, X, Search, Heart, LogOut, User as UserIcon } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useUser } from "@/lib/use-user";

function CartBadge() {
  const { count } = useCart();
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(count);
    const handler = () => {
      const raw = localStorage.getItem("dm_cart");
      try {
        const arr: unknown = raw ? JSON.parse(raw) : [];
        setN(
          Array.isArray(arr)
            ? arr.reduce((s: number, i: unknown) => {
                const qty = (i as { qty?: unknown })?.qty;
                return s + (typeof qty === "number" && Number.isFinite(qty) ? qty : 1);
              }, 0)
            : 0,
        );
      } catch { setN(0); }
    };
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [count]);
  if (n === 0) return <ShoppingBag size={20} strokeWidth={1.5} />;
  return (
    <div className="relative">
      <ShoppingBag size={20} strokeWidth={1.5} />
      <span className="absolute -top-1.5 -right-2 text-[10px] font-mono font-semibold rounded-full bg-[var(--color-signal)] text-white w-[17px] h-[17px] flex items-center justify-center">{n}</span>
    </div>
  );
}

function initialsOf(name: string, email: string): string {
  const base = (name || email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // `next` carries the current location so signing in returns the visitor to
  // where they were. Never point it at /auth itself (would loop).
  const next = pathname.startsWith("/auth") ? "/" : pathname;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenuOpen(false);
    // Hard nav clears in-memory session state everywhere and returns to home.
    window.location.assign("/");
  };

  const navItems = [
    { href: "/explore", label: "Explore" },
    { href: "/studio", label: "Studio" },
    { href: "/creators", label: "Creators" },
    { href: "/blog", label: "Blog" },
    { href: "/agents", label: "Agents" },
  ];

  const accountMenu = user ? (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="row gap-2"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{ padding: "4px 6px 4px 4px", borderRadius: 999, border: "1px solid rgba(12,12,13,0.1)" }}
      >
        <span
          style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 600 }}
        >
          {initialsOf(user.name, user.email)}
        </span>
        <span className="small" style={{ fontWeight: 500 }}>{(user.name || "Account").split(" ")[0]}</span>
      </button>
      {menuOpen && (
        <div
          className="card"
          role="menu"
          style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 232, padding: 8, zIndex: 60, boxShadow: "0 4px 12px rgba(12,12,13,0.06), 0 30px 60px -24px rgba(12,12,13,0.26)" }}
        >
          <div className="row gap-3" style={{ padding: "10px 12px" }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 600, flexShrink: 0 }}>
              {initialsOf(user.name, user.email)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="h5" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || "Account"}</div>
              <div className="tiny faint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(12,12,13,0.1)", margin: "4px 0" }} />
          <Link href="/account" onClick={() => setMenuOpen(false)} className="dm-menu-item" role="menuitem">My account</Link>
          <Link href="/orders" onClick={() => setMenuOpen(false)} className="dm-menu-item" role="menuitem">My orders</Link>
          <button onClick={signOut} className="dm-menu-item" role="menuitem" style={{ width: "100%", textAlign: "left", color: "var(--color-signal)" }}>
            <LogOut size={15} strokeWidth={1.8} style={{ display: "inline", verticalAlign: "-2px", marginRight: 8 }} /> Sign out
          </button>
        </div>
      )}
    </div>
  ) : (
    <>
      <Link href={`/auth?mode=register&next=${encodeURIComponent(next)}`} className="btn btn-sm btn-outline" style={{ padding: "9px 16px", fontSize: "0.875rem" }}>
        Create account
      </Link>
      <Link href={`/auth?next=${encodeURIComponent(next)}`} className="btn btn-sm" style={{ padding: "9px 18px", fontSize: "0.875rem" }}>
        Sign in
      </Link>
    </>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[rgba(247,246,243,0.8)] border-b border-[rgba(12,12,13,0.07)]" style={{ height: 68 }}>
        <div className="container-wide h-full flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="Desmake" width={32} height={32} />
              <span className="text-lg font-semibold tracking-tight">Desmake</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[rgba(12,12,13,0.05)] transition-colors" aria-label="Search">
              <Search size={18} strokeWidth={1.8} />
            </button>
            <Link href="/account" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[rgba(12,12,13,0.05)] transition-colors relative" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.8} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-signal rounded-full" />
            </Link>
            <Link href="/cart" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[rgba(12,12,13,0.05)] transition-colors" aria-label="Cart">
              <CartBadge />
            </Link>
            <Link href="/explore" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[rgba(12,12,13,0.05)] transition-colors" aria-label="Wishlist">
              <Heart size={18} strokeWidth={1.8} />
            </Link>
            {accountMenu}
          </div>

          <button className="md:hidden w-10 h-10 flex items-center justify-center" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[68px] z-40 bg-paper md:hidden" onClick={() => setMobileOpen(false)}>
          <nav className="container-wide py-8 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-2xl font-semibold tracking-tight py-3 border-b border-[rgba(12,12,13,0.08)]"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-3 mt-6">
              {user ? (
                <>
                  <Link href="/account" className="btn flex-1" onClick={() => setMobileOpen(false)}><UserIcon size={18} /> Account</Link>
                  <button className="btn btn-outline" onClick={() => { setMobileOpen(false); void signOut(); }}>Sign out</button>
                </>
              ) : (
                <>
                  <Link href={`/auth?mode=register&next=${encodeURIComponent(next)}`} className="btn flex-1" onClick={() => setMobileOpen(false)}>Create account</Link>
                  <Link href={`/auth?next=${encodeURIComponent(next)}`} className="btn btn-outline" onClick={() => setMobileOpen(false)}>Sign in</Link>
                </>
              )}
              <Link href="/cart" className="btn btn-outline" onClick={() => setMobileOpen(false)}>
                <ShoppingBag size={18} /> Cart
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* Spacer */}
      <div style={{ height: 68 }} />
    </>
  );
}
