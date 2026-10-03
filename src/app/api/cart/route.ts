import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { configured, supabasePublic, previewMode } from "@/lib/supabase/server";
import { demoProducts } from "@/lib/demo";
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 5000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const ids = z.array(z.string().max(100)).max(30).parse(JSON.parse(raw).ids);
    if (!configured())
      return NextResponse.json({
        updates: ids.map((id) => {
          const p = previewMode()
            ? demoProducts.find((p) =>
                p.product_variants.some((v) => v.id === id),
              )
            : undefined;
          const v = p?.product_variants.find((v) => v.id === id);
          return {
            variant_id: id,
            stock: v?.stock_quantity || 0,
            price: p?.selling_price || 0,
            available: !!v?.active,
            name: p?.name,
          };
        }),
      });
    if (!ids.every((id) => z.uuid().safeParse(id).success))
      return NextResponse.json(
        { error: "Invalid cart items" },
        { status: 400 },
      );
    const db = supabasePublic();
    const { data, error } = await db
      .from("product_variants")
      .select(
        "id,stock_quantity,active,products!inner(name,selling_price,status)",
      )
      .in("id", ids);
    if (error) throw error;
    return NextResponse.json(
      {
        updates: ids.map((id) => {
          const v = data?.find((v) => v.id === id);
          const p = v?.products as unknown as
            { name: string; selling_price: number; status: string } | undefined;
          return {
            variant_id: id,
            stock: v?.stock_quantity || 0,
            price: p?.selling_price || 0,
            available: !!v?.active && p?.status === "active",
            name: p?.name,
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to refresh availability." },
      { status: 400 },
    );
  }
}
