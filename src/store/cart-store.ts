"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { savedCartSchema } from "@/lib/cart-validation";
export type CartItem = {
  product_id: string;
  variant_id: string;
  slug: string;
  name: string;
  size: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
  sample?: boolean;
};
type CartState = {
  items: CartItem[];
  add: (item: CartItem) => boolean;
  setQuantity: (id: string, q: number) => void;
  remove: (id: string) => void;
  reconcile: (
    updates: {
      variant_id: string;
      stock: number;
      price: number;
      available: boolean;
      name?: string;
    }[],
  ) => void;
  clear: () => void;
};
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const current = get().items.find(
          (i) => i.variant_id === item.variant_id,
        );
        const q = (current?.quantity || 0) + item.quantity;
        if (q > item.stock || q > 99 || (!current && get().items.length >= 30))
          return false;
        set({
          items: current
            ? get().items.map((i) =>
                i.variant_id === item.variant_id ? { ...item, quantity: q } : i,
              )
            : [...get().items, item],
        });
        return true;
      },
      setQuantity: (id, q) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.variant_id === id
              ? { ...i, quantity: Math.max(1, Math.min(q, i.stock || 1, 99)) }
              : i,
          ),
        })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.variant_id !== id) })),
      reconcile: (updates) =>
        set((s) => ({
          items: s.items.map((i) => {
            const u = updates.find((u) => u.variant_id === i.variant_id);
            return u
              ? {
                  ...i,
                  price: u.price,
                  stock: u.available ? u.stock : 0,
                  name: u.name || i.name,
                }
              : i;
          }),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "achu-cart-v1",
      version: 1,
      partialize: (s) => ({ items: s.items }),
      merge: (persisted, current) => {
        const result = savedCartSchema.safeParse(persisted);
        return { ...current, items: result.success ? result.data.items : [] };
      },
      skipHydration: true,
    },
  ),
);
