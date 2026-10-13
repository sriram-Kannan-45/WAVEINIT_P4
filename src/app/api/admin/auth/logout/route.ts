import { NextRequest, NextResponse } from "next/server";
import {
  hashRefreshToken,
  revokeAdminSession,
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
} from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  // Origin check for CSRF prevention
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.nextUrl.protocol;
  if (origin && !sameOrigin(origin, host, protocol)) {
    return NextResponse.json(
      { ok: false, error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const cookieToken = request.cookies.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
  if (cookieToken) {
    const tokenHash = hashRefreshToken(cookieToken);
    await revokeAdminSession(tokenHash);
  }

  const response = NextResponse.json({
    ok: true,
    message: "Logged out successfully.",
  });

  const isProduction = process.env.NODE_ENV === "production";

  // Invalidate cookies with Max-Age 0
  response.cookies.set(ADMIN_REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });

  return response;
}
