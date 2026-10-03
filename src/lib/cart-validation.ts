import { z } from "zod";
export const savedCartSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1).max(100),
        variant_id: z.string().min(1).max(100),
        slug: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(200),
        name: z.string().max(200),
        size: z.string().max(40),
        image: z
          .string()
          .max(1000)
          .refine((s) => {
            if (/^\/(?!\/)/.test(s)) return true;
            try {
              const u = new URL(s);
              return (
                u.protocol === "https:" &&
                u.origin === process.env.NEXT_PUBLIC_SUPABASE_URL &&
                u.pathname.startsWith("/storage/v1/object/public/boutique/")
              );
            } catch {
              return false;
            }
          }),
        price: z.number().finite().min(0).max(9999999),
        quantity: z.number().int().min(1).max(99),
        stock: z.number().int().min(0).max(999999),
        sample: z.boolean().optional(),
      }),
    )
    .max(30)
    .refine(
      (items) => new Set(items.map((i) => i.variant_id)).size === items.length,
    ),
});
