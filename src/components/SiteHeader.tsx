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
  if (n === 0) return <ShoppingBag size={18} strokeWidth={1.6} />;
  return (
    <div className="relative">
      <ShoppingBag size={18} strokeWidth={1.6} />
      <span
        className="tiny"
        style={{
          position: "absolute",
          top: -4,
          right: -5,
          minWidth: 17,
          height: 17,
          padding: "0 4px",
          borderRadius: "999px",
          background: "var(--signal)",
          color: "#fff",
          fontSize: "10px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 2px var(--paper)",
        }}
      >
        {n}
      </span>
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

  // Desmake DS v1.0 nav: fixed, paper/78 + backdrop blur, 1px hairline.
  useEffect(() => {
    // close menus on route change
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

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
    window.location.assign("/");
  };

  const navItems = [
    { href: "/explore", label: "Explore" },
    { href: "/studio", label: "Studio" },
    { href: "/creators", label: "Creators" },
    ...(user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
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
        style={{ padding: "4px 8px 4px 4px", borderRadius: "var(--r-full)", border: "1px solid var(--line)" }}
      >
        <span
          style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 600 }}
        >
          {initialsOf(user.name, user.email)}
        </span>
        <span className="small" style={{ fontWeight: 500 }}>{(user.name || "Account").split(" ")[0]}</span>
      </button>
      {menuOpen && (
        <div
          className="card"
          role="menu"
          style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 240, padding: 8, zIndex: 60, borderRadius: "var(--r-lg)" }}
        >
          <div className="row gap-3" style={{ padding: "10px 12px" }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 600, flexShrink: 0 }}>
              {initialsOf(user.name, user.email)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="h5" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || "Account"}</div>
              <div className="tiny faint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          <Link href="/account" onClick={() => setMenuOpen(false)} className="dm-menu-item" role="menuitem">My account</Link>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="dm-menu-item" role="menuitem">Creator dashboard</Link>
          <Link href="/orders" onClick={() => setMenuOpen(false)} className="dm-menu-item" role="menuitem">My orders</Link>
          <button onClick={signOut} className="dm-menu-item" role="menuitem" style={{ width: "100%", textAlign: "left", color: "var(--ink)" }}>
            <LogOut size={15} strokeWidth={1.8} style={{ display: "inline", verticalAlign: "-2px", marginRight: 8 }} /> Sign out
          </button>
        </div>
      )}
    </div>
  ) : (
    <>
      <Link href={`/auth?mode=register&next=${encodeURIComponent(next)}`} className="btn btn-sm btn-outline">
        Create account
      </Link>
      <Link href={`/auth?next=${encodeURIComponent(next)}`} className="btn btn-sm btn-signal">
        Sign in
      </Link>
    </>
  );

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          height: "var(--nav-h)",
          background: "rgba(247, 246, 243, 0.78)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container-wide nav-inner">
          <div className="row gap-8" style={{ gap: 28 }}>
            <Link href="/" className="brand">
              <img src="/logo.svg" className="brand-mark" alt="Desmake" width={22} height={22} />
              <span className="brand-tx">Desmake</span>
            </Link>
            <nav className="nav-links">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${pathname.startsWith(item.href) ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="nav-actions">
            <Link href="/explore" className="nav-search" aria-label="Search the marketplace">
              <Search size={16} strokeWidth={1.6} />
              <span>Search the marketplace</span>
              <kbd>/</kbd>
            </Link>
            <Link href="/explore" className="icon-btn" aria-label="Wishlist">
              <Heart size={18} strokeWidth={1.6} />
            </Link>
            <Link href="/account" className="icon-btn" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.6} />
              <span className="nub" />
            </Link>
            <Link href="/cart" className="icon-btn" aria-label="Cart">
              <CartBadge />
            </Link>
            {accountMenu}
          </div>

          <button className="md:hidden icon-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" style={{ marginLeft: 4 }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-paper md:hidden" style={{ top: "var(--nav-h)" }} onClick={() => setMobileOpen(false)}>
          <nav className="container-wide py-8 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-2xl font-medium tracking-tight py-3 border-b border-[rgba(12,12,13,0.08)]"
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
                  <Link href={`/auth?mode=register&next=${encodeURIComponent(next)}`} className="btn btn-signal flex-1" onClick={() => setMobileOpen(false)}>Create account</Link>
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
      <div style={{ height: "var(--nav-h)" }} />
    </>
  );
}
