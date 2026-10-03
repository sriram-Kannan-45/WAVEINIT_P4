import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sameOrigin } from "@/lib/request-origin";
import { supabaseService } from "@/lib/supabase/server";
import { enquirySchema } from "@/lib/validations";
import { orderMessage, whatsappUrl, type OrderSnapshot } from "@/lib/whatsapp";
export async function POST(request: NextRequest) {
  // Next may use its internal listening hostname in nextUrl (e.g. 0.0.0.0).
  // Compare with the incoming Host, which browsers cannot replace on a cross-origin request.
  const protocol =
    process.env.VERCEL && request.headers.get("x-forwarded-proto") === "https"
      ? "https:"
      : request.nextUrl.protocol;
  if (
    !sameOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      protocol,
    )
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 20000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 20000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const parsed = enquirySchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const db = supabaseService();
    // Vercel provides this trusted client address; local development uses a shared local limit.
    const ip = process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for") || "unknown"
      : "local";
    const rateKey = createHash("sha256")
      .update(`checkout:${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
      .digest("hex");
    const rate = await db.rpc("consume_rate_limit", {
      p_key: rateKey,
      p_max: 10,
      p_seconds: 600,
    });
    if (rate.error) throw new Error("Checkout is temporarily unavailable.");
    if (!rate.data)
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes." },
        { status: 429 },
      );
    const { customer, items, idempotency_key } = parsed.data;
    const hash = createHash("sha256")
      .update(JSON.stringify({ customer, items }))
      .digest("hex");
    const result = await db.rpc("create_enquiry", {
      p_customer: customer,
      p_items: items,
      p_key: idempotency_key,
      p_hash: hash,
      p_rate_key: rateKey + "-created",
    });
    if (result.error) {
      const expected =
        /Stock has changed|Price has changed|no longer available|not configured|Too many|Duplicate|request changed/i.test(
          result.error.message,
        );
      return NextResponse.json(
        {
          error: expected
            ? result.error.message
            : "Unable to create the enquiry. Please try again.",
        },
        { status: 409 },
      );
    }
    const order = result.data as OrderSnapshot;
    const url = whatsappUrl(
      order.whatsapp_number,
      orderMessage(order, customer),
    );
    if (!url) throw new Error("WhatsApp ordering is not configured.");
    return NextResponse.json(
      {
        reference: order.reference,
        subtotal: order.subtotal,
        whatsapp_url: url,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid request."
            : error instanceof Error && /not configured/.test(error.message)
              ? error.message
              : "Checkout is temporarily unavailable. Please try again.",
      },
      { status: 503 },
    );
  }
}
