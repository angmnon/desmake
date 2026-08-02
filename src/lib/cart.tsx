"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type CartItem = {
  listingId: string;
  slug: string;
  title: string;
  adapter: string;
  variant: string;
  qty: number;
  priceCents: number;
  seed: string;
  palette: [string, string, string];
  shape: number;
};

type CartCtx = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (idx: number) => void;
  updateQty: (idx: number, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Synchronous initialiser so the first render already has persisted items.
    // Prevents /checkout from incorrectly redirecting to /cart when the cart
    // is non-empty (the old useEffect-only load created a one-frame race).
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("dm_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("dm_cart", JSON.stringify(items));
    } catch {}
    window.dispatchEvent(new Event("cart-updated"));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    // Merge identical lines (same listing + adapter + variant) instead of
    // duplicating — also keeps per-line shipping sensible (Medium).
    setItems((prev) => {
      const idx = prev.findIndex(
        (it) => it.listingId === item.listingId && it.adapter === item.adapter && it.variant === item.variant,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(99, next[idx].qty + item.qty) };
        return next;
      }
      return [...prev, item];
    });
  }, []);
  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const updateQty = useCallback((idx: number, qty: number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(1, qty) } : it));
  }, []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.priceCents * i.qty, 0);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clear, count, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) return { items: [], addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clear: () => {}, count: 0, subtotal: 0 } as CartCtx;
  return c;
}
