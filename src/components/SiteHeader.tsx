"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Bell, ShoppingBag, Menu, X, Search, Heart } from "lucide-react";
import { useCart } from "@/lib/cart";

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

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/explore", label: "Explore" },
    { href: "/studio", label: "Studio" },
    { href: "/creators", label: "Creators" },
    { href: "/agents", label: "Agents" },
  ];

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
            <Link href="/auth?mode=register" className="btn btn-sm btn-outline" style={{ padding: "9px 16px", fontSize: "0.875rem" }}>
              Create account
            </Link>
            <Link href="/auth" className="btn btn-sm" style={{ padding: "9px 18px", fontSize: "0.875rem" }}>
              Sign in
            </Link>
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
              <Link href="/auth?mode=register" className="btn flex-1" onClick={() => setMobileOpen(false)}>Create account</Link>
              <Link href="/auth" className="btn btn-outline" onClick={() => setMobileOpen(false)}>Sign in</Link>
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
