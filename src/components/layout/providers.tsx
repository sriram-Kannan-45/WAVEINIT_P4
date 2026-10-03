"use client";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useCart } from "@/store/cart-store";
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useCart.persist.rehydrate();
  }, []);
  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        richColors
        toastOptions={{ style: { fontFamily: "var(--font-body)" } }}
      />
    </>
  );
}
