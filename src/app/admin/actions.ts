"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  checkAdminCredentials,
  signAdminToken,
} from "@/lib/admin-auth";
import {
  validateUploadFile,
  ImageValidationError,
} from "@/lib/validations/image";
import {
  requireAdmin,
  supabaseServer,
  supabaseService,
  configured,
} from "@/lib/supabase/server";
import {
  taxonomySchema,
  productSchema,
  settingsSchema,
  homepageSchema,
} from "@/lib/validations";
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
  return { ok: false, error: "Unable to save this change. Please try again." };
}
function refresh() {
  revalidatePath("/", "layout");
}
export async function login(form: FormData): Promise<Result> {
  const rawId = String(
    form.get("email") ?? form.get("identifier") ?? form.get("username") ?? "",
  ).trim();
  const password = String(form.get("password") ?? "");

  if (!rawId || !password) {
    return { ok: false, error: "Enter a valid admin ID and password." };
  }

  // 1. Authenticate designated admin ID (achu) and password (1234)
  if (checkAdminCredentials(rawId, password)) {
    const jar = await cookies();
    const token = await signAdminToken("achu");
    jar.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return { ok: true };
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
      const h = await headers();
      const ip = process.env.VERCEL
        ? h.get("x-vercel-forwarded-for") || "unknown"
        : "local";
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
    return { ok: true };
  }

  return { ok: false, error: "The admin ID or password is incorrect." };
}
export async function logout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE_NAME);
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
    const { data, error } = await db.rpc("save_product", {
      p_id: id,
      p_product: product,
      p_variants: variants,
      p_images: images,
      p_collections: collection_ids,
    });
    if (error) throw error;
    refresh();
    return { ok: true, id: data };
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
export async function deleteRecord(
  table: "products" | "categories" | "collections",
  id: string,
): Promise<Result> {
  const db = await requireAdmin();
  try {
    z.enum(["products", "categories", "collections"]).parse(table);
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
    const { error } = await db
      .from("order_enquiries")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
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
      if (
        current !== "1234" &&
        current !== (process.env.ADMIN_PASSWORD || "1234")
      ) {
        return { ok: false, error: "The current password is incorrect." };
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
    const path = `${folder}/${randomUUID()}.${extension}`;
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
