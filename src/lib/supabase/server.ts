import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
export const previewMode = () =>
  !configured() &&
  (process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEMO_PREVIEW === "true");
// Storefront reads always use the public role, even when an owner is browsing.
export function supabasePublic() {
  if (!configured()) throw new Error("Supabase is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
export async function supabaseServer() {
  if (!configured())
    throw new Error(
      "Supabase is not configured. Follow the setup instructions in README.md.",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components cannot set cookies; proxy refreshes the session. */
          }
        },
      },
    },
  );
}
export function supabaseService() {
  if (!configured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      "Live checkout is not configured. Please contact the boutique.",
    );
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireAdmin() {
  if (!configured()) redirect("/admin/login");
  const db = await supabaseServer();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/admin/login");
  const role = await db
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", data.claims.sub)
    .maybeSingle();
  if (role.error || !role.data) redirect("/admin/login?error=unauthorized");
  return db;
}
