"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  checkAdminCredentials,
  authenticateAdmin,
  createAdminAccessToken,
  generateRefreshToken,
  registerAdminSession,
  hashRefreshToken,
  revokeAdminSession,
  revokeMemorySession,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import {
  validateUploadFile,
  ImageValidationError,
} from "@/lib/validations/image";
import { uploadToImageKit } from "@/lib/imagekit";
import {
  requireAdmin,
  supabaseServer,
  supabaseService,
  configured,
} from "@/lib/supabase/server";
import {
  taxonomySchema,
  subcategorySchema,
  productSchema,
  settingsSchema,
  homepageSchema,
  newArrivalSchema,
} from "@/lib/validations";
import { adminNotifications } from "@/lib/admin-data";
import type { AdminNotification } from "@/types";
type Result = { ok: boolean; error?: string; id?: string; path?: string };
function failure(error: unknown): Result {
  if (error instanceof ImageValidationError)
    return { ok: false, error: error.message };
  if (error instanceof z.ZodError)
    return {
      ok: false,
      error: error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 3)
        .join(" · "),
    };
  const message =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message || "";
  if (/duplicate key|unique constraint/.test(message))
    return {
      ok: false,
      error: "This slug or size already exists. Please choose a unique value.",
    };
  if (/foreign key/.test(message))
    return {
      ok: false,
      error:
        "This record is still in use. Reassign its products before deleting it.",
    };
  return { ok: false, error: message || "Unable to save this change. Please try again." };
}
function refresh() {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/shop", "page");
    revalidatePath("/collections", "page");
    revalidatePath("/admin/products", "page");
    revalidatePath("/admin/dashboard", "page");
  } catch {
    /* revalidatePath is active only inside Next.js HTTP request lifecycle */
  }
}
export async function login(form: FormData): Promise<Result> {
  const rawId = String(
    form.get("email") ?? form.get("identifier") ?? form.get("username") ?? "",
  ).trim();
  const password = String(form.get("password") ?? "");

  if (!rawId || !password) {
    return { ok: false, error: "Enter a valid admin ID and password." };
  }

  // Rate limiting per IP
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  const isProd = process.env.NODE_ENV === "production";
  const rateLimit = checkRateLimit(`login:${ip}`, isProd ? 8 : 100, 600);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: `Too many login attempts. Please wait ${rateLimit.resetSeconds} seconds before trying again.`,
    };
  }

  // 1. Authenticate designated admin ID via unified authenticateAdmin
  const auth = await authenticateAdmin(rawId, password);
  if (auth.ok && auth.admin) {
    const jar = await cookies();
    const adminId = auth.admin.id;
    const email = auth.admin.email;
    const accessToken = createAdminAccessToken({
      id: adminId,
      email,
      role: auth.admin.role,
    });

    const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
    await registerAdminSession({
      adminId,
      tokenHash,
      expiresAt: expiresAt.getTime(),
      userAgent: h.get("user-agent") || "",
      ipAddress: ip,
    });

    const isProduction = process.env.NODE_ENV === "production";

    // Set short-lived access token cookie (15m)
    jar.set(ADMIN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SEC,
    });

    // Set rotating refresh token cookie (7d)
    jar.set(ADMIN_REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SEC,
    });

    return { ok: true };
  }

  if (auth.error === "account_disabled") {
    return { ok: false, error: "This administrator account is disabled." };
  }

  // 2. Authenticate against Supabase if configured
  if (configured()) {
    const parsed = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
      })
      .safeParse({ email: rawId, password });
    if (!parsed.success)
      return { ok: false, error: "The admin ID or password is incorrect." };

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = createHash("sha256")
        .update(`login:${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
        .digest("hex");
      const limit = await supabaseService().rpc("consume_rate_limit", {
        p_key: key,
        p_max: 8,
        p_seconds: 600,
      });
      if (limit.error || !limit.data)
        return {
          ok: false,
          error: "Please wait a few minutes before trying to sign in again.",
        };
    }

    const db = await supabaseServer();
    const { data, error } = await db.auth.signInWithPassword(parsed.data);
    if (error || !data.user)
      return { ok: false, error: "The admin ID or password is incorrect." };
    const role = await db
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!role.data || role.error) {
      await db.auth.signOut();
      return {
        ok: false,
        error: "This account is not authorized to manage the boutique.",
      };
    }

    const jar = await cookies();
    const accessToken = createAdminAccessToken({
      id: data.user.id,
      email: data.user.email,
      role: "admin",
    });
    const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
    await registerAdminSession({
      adminId: data.user.id,
      tokenHash,
      expiresAt: expiresAt.getTime(),
      userAgent: h.get("user-agent") || "",
      ipAddress: ip,
    });

    const isProduction = process.env.NODE_ENV === "production";
    jar.set(ADMIN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SEC,
    });
    jar.set(ADMIN_REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SEC,
    });

    return { ok: true };
  }

  return { ok: false, error: "The admin ID or password is incorrect." };
}
export async function logout() {
  const jar = await cookies();
  const refreshCookie = jar.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
  if (refreshCookie) {
    const tokenHash = hashRefreshToken(refreshCookie);
    await revokeAdminSession(tokenHash);
  }

  jar.delete(ADMIN_COOKIE_NAME);
  jar.delete(ADMIN_REFRESH_COOKIE_NAME);

  if (configured()) {
    try {
      const db = await supabaseServer();
      await db.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  redirect("/admin/login");
}
export async function saveProduct(
  id: string | null,
  input: unknown,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    if (id) z.uuid().parse(id);
    const { variants, images, collection_ids, ...product } =
      productSchema.parse(input);

    // 1. Try RPC execution first
    try {
      const { data, error } = await db.rpc("save_product", {
        p_id: id,
        p_product: product,
        p_variants: variants,
        p_images: images,
        p_collections: collection_ids,
      });
      if (!error && data) {
        refresh();
        return { ok: true, id: data };
      }
    } catch {
      /* Fall through to direct table persistence */
    }

    // 2. Direct service-role table persistence fallback
    const pid = id || randomUUID();
    const productPayload = {
      id: pid,
      name: product.name,
      slug: product.slug,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id || null,
      short_description: product.short_description || "",
      description: product.description || "",
      fabric: product.fabric || "",
      colour: product.colour || "",
      care_instructions: product.care_instructions || "",
      sku: product.sku || "",
      keywords: product.keywords || "",
      original_price: product.original_price ?? null,
      selling_price: product.selling_price,
      status: product.status,
      is_featured: Boolean(product.is_featured),
      is_new_arrival: Boolean(product.is_new_arrival),
      is_best_seller: Boolean(product.is_best_seller),
      meta_title: product.meta_title || "",
      meta_description: product.meta_description || "",
    };

    const { error: pErr } = await db.from("products").upsert(productPayload);
    if (pErr) throw pErr;

    // Handle variant synchronization
    if (id) {
      const keepSizes = variants.map((v) => v.size);
      if (keepSizes.length > 0) {
        const { data: existingVariants } = await db
          .from("product_variants")
          .select("id, size")
          .eq("product_id", pid);
        if (existingVariants) {
          const toDelete = existingVariants.filter(
            (ev) => !keepSizes.includes(ev.size),
          );
          for (const td of toDelete) {
            await db.from("product_variants").delete().eq("id", td.id);
          }
        }
      }
    }

    for (const v of variants) {
      const { error: vErr } = await db.from("product_variants").upsert(
        {
          product_id: pid,
          size: v.size,
          stock_quantity: v.stock_quantity,
          active: v.active,
          sku: v.sku || "",
          price: v.price ?? null,
        },
        { onConflict: "product_id,size" },
      );
      if (vErr) throw vErr;
    }

    // Handle images synchronization
    await db.from("product_images").delete().eq("product_id", pid);
    if (images.length > 0) {
      const { error: iErr } = await db.from("product_images").insert(
        images.map((img) => ({
          product_id: pid,
          storage_path: img.storage_path,
          alt_text: img.alt_text || "",
          sort_order: img.sort_order,
          is_cover: Boolean(img.is_cover),
        })),
      );
      if (iErr) throw iErr;
    }

    // Handle collections synchronization
    await db.from("product_collections").delete().eq("product_id", pid);
    if (collection_ids && collection_ids.length > 0) {
      const { error: cErr } = await db.from("product_collections").insert(
        collection_ids.map((cId) => ({
          product_id: pid,
          collection_id: cId,
        })),
      );
      if (cErr) throw cErr;
    }

    refresh();
    return { ok: true, id: pid };
  } catch (e) {
    return failure(e);
  }
}
export async function saveTaxonomy(
  table: "categories" | "collections",
  id: string | null,
  input: unknown,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.enum(["categories", "collections"]).parse(table);
    if (id) z.uuid().parse(id);
    const parsed = taxonomySchema.parse(input);
    if (table === "categories") delete parsed.featured;
    const result = id
      ? await db.from(table).update(parsed).eq("id", id).select("id").single()
      : await db.from(table).insert(parsed).select("id").single();
    if (result.error) throw result.error;
    refresh();
    return { ok: true, id: result.data.id };
  } catch (e) {
    return failure(e);
  }
}
export async function saveSubcategory(
  id: string | null,
  input: unknown,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    if (id) z.uuid().parse(id);
    const parsed = subcategorySchema.parse(input);
    const result = id
      ? await db
          .from("subcategories")
          .update(parsed)
          .eq("id", id)
          .select("id")
          .single()
      : await db.from("subcategories").insert(parsed).select("id").single();
    if (result.error) throw result.error;
    refresh();
    return { ok: true, id: result.data.id };
  } catch (e) {
    return failure(e);
  }
}
export async function deleteRecord(
  table: "products" | "categories" | "collections" | "subcategories" | "new_arrivals",
  id: string,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.enum(["products", "categories", "collections", "subcategories", "new_arrivals"]).parse(
      table,
    );
    z.uuid().parse(id);
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function setProductStatus(
  id: string,
  status: "active" | "hidden",
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.uuid().parse(id);
    z.enum(["active", "hidden"]).parse(status);
    if (status === "active") {
      const images = await db
        .from("product_images")
        .select("id")
        .eq("product_id", id)
        .limit(1);
      if (!images.data?.length)
        return {
          ok: false,
          error: "Upload a product image before publishing.",
        };
    }
    const { error } = await db.from("products").update({ status }).eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function updateInventory(
  id: string,
  stock: number,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.uuid().parse(id);
    z.number().int().min(0).max(999999).parse(stock);
    const { error } = await db
      .from("product_variants")
      .update({ stock_quantity: stock })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function setEnquiryStatus(
  id: string,
  status: string,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.uuid().parse(id);
    z.enum(["new", "contacted", "confirmed", "cancelled", "completed"]).parse(
      status,
    );
    // Use atomic inventory deduction/restoration RPC
    const rpcRes = await db.rpc("admin_set_enquiry_status", {
      p_enquiry_id: id,
      p_status: status,
    });
    if (rpcRes.error) {
      // Fallback in case of mock/demo db
      const { error } = await db
        .from("order_enquiries")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function saveNewArrival(
  id: string | null,
  input: unknown,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    if (id) z.uuid().parse(id);
    const data = newArrivalSchema.parse(input);
    const payload = {
      product_id: data.product_id,
      display_order: data.display_order,
      badge_text: data.badge_text,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      active: data.active,
    };
    if (id) {
      const { error } = await db
        .from("new_arrivals")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("new_arrivals")
        .insert(payload);
      if (error) throw error;
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function toggleNewArrival(
  id: string,
  active: boolean,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.uuid().parse(id);
    const { error } = await db
      .from("new_arrivals")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function markNotificationRead(
  id: string,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.uuid().parse(id);
    const { error } = await db
      .from("admin_notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function markAllNotificationsRead(): Promise<Result> {
  const db = await requireAdmin();
  try {
    const { error } = await db
      .from("admin_notifications")
      .update({ read: true })
      .eq("read", false);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function getNotifications(): Promise<{
  ok: boolean;
  data?: AdminNotification[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const data = await adminNotifications();
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}
export async function saveSettings(input: unknown): Promise<Result> {
  const db = await requireAdmin();
  try {
    const settings = settingsSchema.parse(input);
    const { error } = await db
      .from("store_settings")
      .upsert({ ...settings, id: 1 });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function saveHomepage(input: unknown): Promise<Result> {
  const db = await requireAdmin();
  try {
    const h = homepageSchema.parse(input);
    const { error } = await db.from("homepage_settings").upsert({
      ...h,
      id: 1,
      featured_collection_id: h.featured_collection_id || null,
    });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function savePolicies(input: unknown): Promise<Result> {
  const db = await requireAdmin();
  try {
    const values = z
      .array(
        z.object({
          slug: z.enum([
            "shipping-policy",
            "return-exchange",
            "privacy-policy",
            "terms",
          ]),
          title: z.string().trim().min(1).max(200),
          content: z.string().trim().min(1).max(30000),
        }),
      )
      .length(4)
      .parse(input);
    if (new Set(values.map((v) => v.slug)).size !== 4) throw new Error();
    const { error } = await db
      .from("policies")
      .upsert(values, { onConflict: "slug" });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function updatePassword(form: FormData): Promise<Result> {
  const db = await requireAdmin();
  try {
    const current = z.string().min(1).max(200).parse(form.get("current"));
    const password = z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(200)
      .parse(form.get("password"));
    if (password !== form.get("confirm"))
      return { ok: false, error: "The new passwords do not match." };
    if (!configured()) {
      if (!checkAdminCredentials("achu", current)) {
        return { ok: false, error: "The current password is incorrect." };
      }
      // Revoke any previous refresh sessions
      const jar = await cookies();
      const refreshCookie = jar.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
      if (refreshCookie) {
        revokeMemorySession(hashRefreshToken(refreshCookie));
      }
      return { ok: true };
    }
    const { data } = await db.auth.getUser();
    if (!data.user?.email)
      return { ok: false, error: "Unable to verify this account." };
    const verified = await db.auth.signInWithPassword({
      email: data.user.email,
      password: current,
    });
    if (verified.error)
      return { ok: false, error: "The current password is incorrect." };
    const { error } = await db.auth.updateUser({ password });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function uploadImage(form: FormData): Promise<Result> {
  const db = await requireAdmin();
  try {
    const folder = z
      .enum(["products", "categories", "collections", "banners"])
      .parse(form.get("folder"));
    const file = form.get("file");
    const { bytes, extension, contentType } = await validateUploadFile(file);
    const fileName = `${randomUUID()}.${extension}`;

    // If ImageKit private key is configured, securely upload to ImageKit on the backend
    if (process.env.IMAGEKIT_PRIVATE_KEY) {
      const uploadRes = await uploadToImageKit({
        fileBytes: bytes,
        fileName,
        folder,
        tags: ["boutique", folder],
      });
      return { ok: true, path: uploadRes.url };
    }

    // Fallback to Supabase storage when ImageKit private key is not configured
    const path = `${folder}/${fileName}`;
    const { error } = await db.storage.from("boutique").upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    return { ok: true, path };
  } catch (e) {
    return failure(e);
  }
}
