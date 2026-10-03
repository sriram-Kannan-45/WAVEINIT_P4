import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  // Check custom admin session first
  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdminAuthenticated = await verifyAdminToken(adminCookie);

  if (isAdminAuthenticated) {
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return response;
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

  const { data, error } = await db.auth.getClaims();
  if (!isLoginPage && (error || !data?.claims?.sub)) {
    const denied = NextResponse.redirect(new URL("/admin/login", request.url));
    response.cookies.getAll().forEach((c) => denied.cookies.set(c));
    return denied;
  }

  if (isLoginPage && data?.claims?.sub) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
