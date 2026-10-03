import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return request.nextUrl.pathname === "/admin/login"
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
  if (
    request.nextUrl.pathname !== "/admin/login" &&
    (error || !data?.claims?.sub)
  ) {
    const denied = NextResponse.redirect(new URL("/admin/login", request.url));
    response.cookies.getAll().forEach((c) => denied.cookies.set(c));
    return denied;
  }
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
