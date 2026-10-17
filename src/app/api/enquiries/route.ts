import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sameOrigin } from "@/lib/request-origin";
import { supabaseService } from "@/lib/supabase/server";
import { enquirySchema } from "@/lib/validations";
import {
  orderMessage,
  whatsappUrl,
  createVendorOrderGroups,
  type OrderSnapshot,
  type OrderItem,
} from "@/lib/whatsapp";
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
    let order: OrderSnapshot;

    if (!result.error && result.data) {
      order = result.data as OrderSnapshot;
    } else {
      const errMsg = result.error?.message || "";
      const expected =
        /Stock has changed|Price has changed|no longer available|not configured|Too many|Duplicate|request changed/i.test(
          errMsg,
        );
      if (expected) {
        return NextResponse.json(
          { error: errMsg },
          { status: 409 },
        );
      }

      // Robust service-role fallback if PostgreSQL function is not updated on remote DB
      // 1. Idempotency check
      const { data: existing } = await db
        .from("order_enquiries")
        .select("id, order_reference, subtotal, request_hash")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existing) {
        if (existing.request_hash && existing.request_hash !== hash) {
          return NextResponse.json(
            { error: "Duplicate idempotency key with different request payload." },
            { status: 409 },
          );
        }
        const { data: existingItems } = await db
          .from("order_enquiry_items")
          .select("product_id, variant_id, product_name_snapshot, size_snapshot, quantity, unit_price_snapshot")
          .eq("order_enquiry_id", existing.id);

        const { data: storeSetting } = await db
          .from("store_settings")
          .select("whatsapp_number")
          .eq("id", 1)
          .maybeSingle();

        order = {
          reference: existing.order_reference,
          subtotal: Number(existing.subtotal),
          whatsapp_number: storeSetting?.whatsapp_number || "919629660022",
          items: (existingItems || []).map((ei) => ({
            product_id: ei.product_id,
            variant_id: ei.variant_id,
            name: ei.product_name_snapshot,
            size: ei.size_snapshot,
            quantity: ei.quantity,
            price: Number(ei.unit_price_snapshot),
          })),
        };
      } else {
        // 2. Fetch authoritative prices and validate stock without deducting
        const { data: storeSetting } = await db
          .from("store_settings")
          .select("whatsapp_number")
          .eq("id", 1)
          .maybeSingle();
        const whatsappNumber = storeSetting?.whatsapp_number || "919629660022";

        const orderItemsSnapshots: OrderItem[] = [];
        let calculatedTotal = 0;

        for (const item of items) {
          const { data: prod } = await db
            .from("products")
            .select("id, name, selling_price, status")
            .eq("id", item.product_id)
            .maybeSingle();

          if (!prod || prod.status !== "active") {
            return NextResponse.json(
              { error: "A product in your cart is no longer available." },
              { status: 409 },
            );
          }

          const { data: variant } = await db
            .from("product_variants")
            .select("id, size, price, stock_quantity, active")
            .eq("id", item.variant_id)
            .maybeSingle();

          if (!variant || !variant.active) {
            return NextResponse.json(
              { error: `Selected size for '${prod.name}' is no longer available.` },
              { status: 409 },
            );
          }

          if (variant.stock_quantity < item.quantity) {
            return NextResponse.json(
              { error: `Stock has changed for ${prod.name}. Please refresh your cart.` },
              { status: 409 },
            );
          }

          const actualPrice =
            variant.price != null ? Number(variant.price) : Number(prod.selling_price);

          if (actualPrice !== item.expected_price) {
            return NextResponse.json(
              { error: `Price has changed for ${prod.name}. Please refresh your cart.` },
              { status: 409 },
            );
          }

          calculatedTotal += actualPrice * item.quantity;
          orderItemsSnapshots.push({
            product_id: prod.id,
            variant_id: variant.id,
            name: prod.name,
            size: variant.size,
            quantity: item.quantity,
            price: actualPrice,
          });
        }

        // Generate reference
        const dateStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
        })
          .format(new Date())
          .replace(/-/g, "");
        const ref = `ACHU-${dateStr}-${(globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12).toUpperCase()}`;

        const addressFormatted = [
          customer.address_line_1,
          customer.address_line_2,
        ]
          .filter(Boolean)
          .join(", ");

        const { data: insertedOrder, error: insErr } = await db
          .from("order_enquiries")
          .insert({
            order_reference: ref,
            idempotency_key,
            request_hash: hash,
            customer_name: customer.full_name,
            phone: customer.phone,
            alternate_phone: customer.alternate_phone || "",
            address: addressFormatted,
            city: customer.city,
            state: customer.state,
            pincode: customer.pincode,
            landmark: customer.landmark || "",
            customer_note: customer.note || "",
            subtotal: calculatedTotal,
            status: "new",
            stock_deducted: false,
          })
          .select()
          .single();

        if (insErr) {
          throw new Error("Unable to create order enquiry: " + insErr.message);
        }

        // Insert items
        const itemInserts = orderItemsSnapshots.map((snap) => ({
          order_enquiry_id: insertedOrder.id,
          product_id: snap.product_id,
          variant_id: snap.variant_id,
          product_name_snapshot: snap.name,
          size_snapshot: snap.size,
          quantity: snap.quantity,
          unit_price_snapshot: snap.price,
          subtotal_snapshot: snap.price * snap.quantity,
        }));

        await db.from("order_enquiry_items").insert(itemInserts);

        // Insert admin notification
        try {
          const { error: notifErr } = await db.from("admin_notifications").insert({
            type: "new_order",
            order_id: insertedOrder.id,
            order_reference: ref,
            title: "New WhatsApp Order Received",
            message: `Order ${ref} placed by ${customer.full_name} for ₹${calculatedTotal}. Awaiting confirmation.`,
          });
          if (notifErr) throw notifErr;
        } catch {
          /* Fallback for legacy notification schema requiring product_id/variant_id */
          try {
            await db.from("admin_notifications").insert({
              type: "low_stock",
              product_id: items[0]?.product_id,
              variant_id: items[0]?.variant_id,
              title: `New WhatsApp Order: ${ref}`,
              message: `Order ${ref} placed by ${customer.full_name} for ₹${calculatedTotal}. Awaiting confirmation.`,
              product_name: orderItemsSnapshots[0]?.name || "Product",
              size: orderItemsSnapshots[0]?.size || "Standard",
              stock_quantity: 1,
            });
          } catch {
            /* Notification fallback ignored */
          }
        }

        order = {
          reference: ref,
          subtotal: calculatedTotal,
          whatsapp_number: whatsappNumber,
          items: orderItemsSnapshots,
        };
      }
    }
    const enrichedItems: OrderItem[] = order.items.map((it, idx) => {
      const match = items[idx];
      return {
        ...it,
        vendor_name: match?.vendor_name,
        vendor_whatsapp_number: match?.vendor_whatsapp_number,
      };
    });

    const defaultVendor = {
      name: "Achu Designer Boutique",
      whatsapp_number: order.whatsapp_number,
    };

    const vendorGroups = createVendorOrderGroups(
      enrichedItems,
      defaultVendor,
      customer,
      order.reference,
    );

    const fallbackUrl = whatsappUrl(
      order.whatsapp_number,
      orderMessage(order, customer),
    );

    const primaryUrl =
      vendorGroups.length > 0 && vendorGroups[0].whatsapp_url
        ? vendorGroups[0].whatsapp_url
        : fallbackUrl;

    if (!primaryUrl) throw new Error("WhatsApp ordering is not configured.");

    return NextResponse.json(
      {
        reference: order.reference,
        subtotal: order.subtotal,
        whatsapp_url: primaryUrl,
        vendor_orders: vendorGroups,
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
