import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
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
import {
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
  verifyAdminToken,
  verifyAdminAccessToken,
  createAdminAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  rotateAdminSession,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  getAdminServiceClient,
  type AdminTokenPayload,
} from "@/lib/admin-auth";
import { createDemoAdminDb } from "./demo-db";

export async function getAuthenticatedAdmin(): Promise<AdminTokenPayload | null> {
  // 0. Check programmatic admin bearer override (for audit/test harnesses)
  if (process.env.ADMIN_BEARER_OVERRIDE) {
    const payload = verifyAdminAccessToken(process.env.ADMIN_BEARER_OVERRIDE);
    if (payload) {
      return payload;
    }
  }

  // 1. Check Authorization Bearer header
  try {
    const h = await headers();
    const authHeader = h.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7).trim();
      const payload = verifyAdminAccessToken(bearerToken);
      if (payload) {
        return payload;
      }
    }
  } catch {
    /* headers() unavailable in some execution contexts */
  }

  // 2. Check session cookie
  try {
    const jar = await cookies();
    const cookieToken = jar.get(ADMIN_COOKIE_NAME)?.value;
    if (cookieToken) {
      const payload = verifyAdminAccessToken(cookieToken);
      if (payload) {
        return payload;
      }
      // Check legacy / fallback verification
      const isValid = await verifyAdminToken(cookieToken);
      if (isValid) {
        return {
          sub: "achu",
          email: "achu@achuboutique.com",
          role: "admin",
          iss: "achu-boutique",
          aud: "achu-boutique-admin",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          jti: "legacy-session",
        };
      }
    }
  } catch {
    /* cookies() unavailable */
  }

  return null;
}

export async function requireAdmin(): Promise<
  Awaited<ReturnType<typeof supabaseServer>>
> {
  let adminPayload = await getAuthenticatedAdmin();

  // If access token was missing or expired, check if refresh cookie can restore it
  if (!adminPayload) {
    try {
      const jar = await cookies();
      const refreshCookie = jar.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
      if (refreshCookie) {
        const oldHash = hashRefreshToken(refreshCookie);
        const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
        const rot = await rotateAdminSession(oldHash, tokenHash, expiresAt.getTime());
        if (rot.ok) {
          const adminId = rot.admin_id || rot.adminId || "achu";
          const newAccessToken = createAdminAccessToken({
            id: adminId,
            role: "admin",
          });
          const isProduction = process.env.NODE_ENV === "production";
          try {
            jar.set(ADMIN_COOKIE_NAME, newAccessToken, {
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
          } catch {
            /* Server Components cannot set cookies; proxy handles it on navigation */
          }
          adminPayload = verifyAdminAccessToken(newAccessToken);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (adminPayload) {
    // If database is available, ensure account is active
    const dbClient = getAdminServiceClient();
    if (dbClient) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          adminPayload.sub,
        );
        const query = dbClient.from("admin_users").select("is_active");
        const { data } = isUuid
          ? await query.eq("id", adminPayload.sub).maybeSingle()
          : await query.or(`username.eq.${adminPayload.sub},email.eq.${adminPayload.email}`).maybeSingle();
        if (data && !data.is_active) {
          redirect("/admin/login?error=account_disabled");
        }
      } catch (err: unknown) {
        if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err;
        }
      }
    }

    if (configured()) {
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return supabaseService() as unknown as Awaited<
            ReturnType<typeof supabaseServer>
          >;
        }
        return await supabaseServer();
      } catch {
        /* Fall back to demo database when database is not connected */
      }
    }
    return createDemoAdminDb() as unknown as Awaited<
      ReturnType<typeof supabaseServer>
    >;
  }

  if (!configured()) redirect("/admin/login");
  const db = await supabaseServer();
  try {
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) redirect("/admin/login");
    const role = await db
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (role.error || !role.data) redirect("/admin/login?error=unauthorized");
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/admin/login");
  }
  return db;
}
