import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
  verifyAdminToken,
  createAdminAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  rotateAdminSession,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  // Check custom admin session first
  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const refreshCookie = request.cookies.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
  const isAdminAuthenticated = await verifyAdminToken(adminCookie);

  if (isAdminAuthenticated) {
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return response;
  }

  // If access token expired or not set, but refresh token exists, attempt transparent rotation
  if (refreshCookie) {
    try {
      const oldTokenHash = hashRefreshToken(refreshCookie);
      const { rawToken: rawNewToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } =
        generateRefreshToken();
      const userAgent = request.headers.get("user-agent") || "";
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "local";

      const rot = await rotateAdminSession(
        oldTokenHash,
        newTokenHash,
        newExpiresAt.getTime(),
        userAgent,
        ip,
      );

      const isProduction = process.env.NODE_ENV === "production";

      if (rot.ok) {
        const adminId = rot.admin_id || rot.adminId || "achu";
        const newAccessToken = createAdminAccessToken({
          id: adminId,
          role: "admin",
        });

        if (isLoginPage) {
          const redirectRes = NextResponse.redirect(
            new URL("/admin/dashboard", request.url),
          );
          redirectRes.cookies.set(ADMIN_COOKIE_NAME, newAccessToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
            maxAge: ACCESS_TOKEN_TTL_SEC,
          });
          redirectRes.cookies.set(ADMIN_REFRESH_COOKIE_NAME, rawNewToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
            maxAge: REFRESH_TOKEN_TTL_SEC,
          });
          return redirectRes;
        }

        // On protected admin routes, update request cookies so downstream server components see the token
        request.cookies.set(ADMIN_COOKIE_NAME, newAccessToken);
        request.cookies.set(ADMIN_REFRESH_COOKIE_NAME, rawNewToken);

        const nextRes = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        nextRes.cookies.set(ADMIN_COOKIE_NAME, newAccessToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: ACCESS_TOKEN_TTL_SEC,
        });
        nextRes.cookies.set(ADMIN_REFRESH_COOKIE_NAME, rawNewToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: REFRESH_TOKEN_TTL_SEC,
        });

        return nextRes;
      } else {
        // Rotation failed (expired, revoked, reuse detected, account disabled)
        if (!isLoginPage) {
          const denied = NextResponse.redirect(
            new URL(
              rot.error === "account_disabled"
                ? "/admin/login?error=account_disabled"
                : "/admin/login?error=session_expired",
              request.url,
            ),
          );
          denied.cookies.set(ADMIN_COOKIE_NAME, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
            maxAge: 0,
          });
          denied.cookies.set(ADMIN_REFRESH_COOKIE_NAME, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
            maxAge: 0,
          });
          return denied;
        }
      }
    } catch {
      // Rotation exception fallback
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return isLoginPage
      ? response
      : NextResponse.redirect(new URL("/admin/login", request.url));

  const db = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    const { data, error } = await db.auth.getUser();
    if (!isLoginPage && (error || !data?.user)) {
      const denied = NextResponse.redirect(new URL("/admin/login", request.url));
      response.cookies.getAll().forEach((c) => denied.cookies.set(c));
      return denied;
    }

    if (isLoginPage && data?.user) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  } catch {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
