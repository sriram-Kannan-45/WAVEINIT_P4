"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
  vendor_name?: string;
  vendor_whatsapp_number?: string;
};

export type CartHistorySnapshot = {
  items: CartItem[];
  actionLabel?: string;
};

type CartState = {
  items: CartItem[];
  past: CartHistorySnapshot[];
  future: CartHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
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
  undo: () => boolean;
  redo: () => boolean;
};

function cloneItems(items: CartItem[]): CartItem[] {
  return items.map((i) => ({ ...i }));
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,

      add: (item) => {
        const previous = cloneItems(get().items);
        const current = previous.find(
          (i) => i.variant_id === item.variant_id,
        );
        const q = (current?.quantity || 0) + item.quantity;
        if (q > item.stock || q > 99 || (!current && previous.length >= 30))
          return false;

        const nextItems = current
          ? previous.map((i) =>
              i.variant_id === item.variant_id ? { ...item, quantity: q } : i,
            )
          : [...previous, item];

        const nextPast = [
          ...get().past,
          { items: previous, actionLabel: `Added ${item.name}` },
        ].slice(-25);

        set({
          items: nextItems,
          past: nextPast,
          future: [],
          canUndo: true,
          canRedo: false,
          undoCount: nextPast.length,
          redoCount: 0,
        });
        return true;
      },

      setQuantity: (id, q) => {
        const previous = cloneItems(get().items);
        const target = previous.find((i) => i.variant_id === id);
        if (!target) return;
        const clampedQ = Math.max(1, Math.min(q, target.stock || 1, 99));
        if (target.quantity === clampedQ) return;

        const nextItems = previous.map((i) =>
          i.variant_id === id ? { ...i, quantity: clampedQ } : i,
        );

        const nextPast = [
          ...get().past,
          { items: previous, actionLabel: `Changed quantity of ${target.name}` },
        ].slice(-25);

        set({
          items: nextItems,
          past: nextPast,
          future: [],
          canUndo: true,
          canRedo: false,
          undoCount: nextPast.length,
          redoCount: 0,
        });
      },

      remove: (id) => {
        const previous = cloneItems(get().items);
        const target = previous.find((i) => i.variant_id === id);
        if (!target) return;

        const nextItems = previous.filter((i) => i.variant_id !== id);
        const nextPast = [
          ...get().past,
          { items: previous, actionLabel: `Removed ${target.name}` },
        ].slice(-25);

        set({
          items: nextItems,
          past: nextPast,
          future: [],
          canUndo: true,
          canRedo: false,
          undoCount: nextPast.length,
          redoCount: 0,
        });
      },

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

      clear: () => {
        const previous = cloneItems(get().items);
        if (previous.length === 0) return;

        const nextPast = [
          ...get().past,
          { items: previous, actionLabel: "Cleared shopping bag" },
        ].slice(-25);

        set({
          items: [],
          past: nextPast,
          future: [],
          canUndo: true,
          canRedo: false,
          undoCount: nextPast.length,
          redoCount: 0,
        });
      },

      undo: () => {
        const past = get().past;
        if (past.length === 0) return false;

        const previousSnapshot = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        const currentItems = cloneItems(get().items);

        const newFuture = [{ items: currentItems }, ...get().future].slice(0, 25);

        set({
          items: cloneItems(previousSnapshot.items),
          past: newPast,
          future: newFuture,
          canUndo: newPast.length > 0,
          canRedo: true,
          undoCount: newPast.length,
          redoCount: newFuture.length,
        });
        return true;
      },

      redo: () => {
        const future = get().future;
        if (future.length === 0) return false;

        const nextSnapshot = future[0];
        const newFuture = future.slice(1);
        const currentItems = cloneItems(get().items);

        const newPast = [...get().past, { items: currentItems }].slice(-25);

        set({
          items: cloneItems(nextSnapshot.items),
          past: newPast,
          future: newFuture,
          canUndo: true,
          canRedo: newFuture.length > 0,
          undoCount: newPast.length,
          redoCount: newFuture.length,
        });
        return true;
      },
    }),
    {
      name: "achu-cart-v1",
      version: 1,
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (s) => ({ items: s.items }),
      merge: (persisted, current) => {
        const result = savedCartSchema.safeParse(persisted);
        return {
          ...current,
          items: result.success ? result.data.items : [],
          past: [],
          future: [],
          canUndo: false,
          canRedo: false,
          undoCount: 0,
          redoCount: 0,
        };
      },
      skipHydration: true,
    },
  ),
);
