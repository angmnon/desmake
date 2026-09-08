"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { track } from "@/lib/tracking";

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
  /** M3: 具体商品 SKU（下单时按 SKU 真实供应链成本计价） */
  sku: string;
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

export const MAX_QTY = 99;

/**
 * Defensive parse. `dm_cart` is user-writable and lives across deploys, so a corrupt
 * or stale-shape entry is entirely possible. Previously `JSON.parse` output was used
 * directly: a non-array made `items.reduce` throw during render, and with no
 * error boundary anywhere in the app that meant a blank site with no way to recover.
 * A numeric-but-invalid `priceCents` produced NaN, which `money()` renders as "$0.00".
 */
function sanitizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const listingId = typeof o.listingId === "string" ? o.listingId : "";
    const qty = Number(o.qty);
    const price = Number(o.priceCents);
    if (!listingId) continue;
    if (!Number.isFinite(qty) || qty < 1) continue;
    const palette = Array.isArray(o.palette) && o.palette.length === 3
      ? (o.palette as [string, string, string])
      : (["#d9d7d2", "#b8b5ae", "#8f8c85"] as [string, string, string]);
    out.push({
      listingId,
      slug: typeof o.slug === "string" ? o.slug : "",
      title: typeof o.title === "string" ? o.title : "Item",
      adapter: typeof o.adapter === "string" ? o.adapter : "",
      variant: typeof o.variant === "string" ? o.variant : "",
      qty: Math.min(MAX_QTY, Math.max(1, Math.floor(qty))),
      priceCents: Number.isFinite(price) && price >= 0 ? Math.floor(price) : 0,
      seed: typeof o.seed === "string" ? o.seed : listingId,
      palette,
      shape: Number.isFinite(Number(o.shape)) ? Number(o.shape) : 0,
      sku: typeof o.sku === "string" ? o.sku : "",
    });
  }
  return out;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Synchronous initialiser so the first render already has persisted items.
    // Prevents /checkout from incorrectly redirecting to /cart when the cart
    // is non-empty (the old useEffect-only load created a one-frame race).
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("dm_cart");
      return saved ? sanitizeCart(JSON.parse(saved)) : [];
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

  // Cross-tab sync. Without this, whichever tab wrote last silently clobbered the
  // others: a second tab's additions vanished, and items already ordered in one tab
  // could be written back into localStorage from a stale tab and re-purchased.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "dm_cart") return;
      try {
        setItems(sanitizeCart(JSON.parse(e.newValue || "[]")));
      } catch {
        /* ignore unparseable payload from another tab */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((item: CartItem) => {
    // Merge identical lines (same listing + adapter + variant) instead of
    // duplicating — also keeps per-line shipping sensible (Medium).
    setItems((prev) => {
      const idx = prev.findIndex(
        (it) => it.listingId === item.listingId && it.adapter === item.adapter && it.variant === item.variant && it.sku === item.sku,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(MAX_QTY, next[idx].qty + item.qty) };
        return next;
      }
      // New lines must respect the same cap the API enforces, or the whole order is
      // rejected at the last step with no client-side warning.
      return [...prev, { ...item, qty: Math.min(MAX_QTY, Math.max(1, item.qty)) }];
    });
    // P0-2: standard ecommerce event for ad attribution / retargeting.
    track("add_to_cart", {
      currency: "USD",
      value: (item.priceCents * item.qty) / 100,
      items: [{ item_id: item.slug, item_name: item.title, price: item.priceCents / 100, quantity: item.qty }],
    });
  }, []);
  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const updateQty = useCallback((idx: number, qty: number) => {
    // Clamp to the server's MAX_QTY: an unlimited stepper let buyers build a line the
    // API would refuse, failing the entire order.
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: Math.min(MAX_QTY, Math.max(1, Math.floor(qty) || 1)) } : it)),
    );
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
