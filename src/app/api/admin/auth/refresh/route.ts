import { NextRequest, NextResponse } from "next/server";
import {
  hashRefreshToken,
  generateRefreshToken,
  rotateAdminSession,
  createAdminAccessToken,
  verifyAdminAccessToken,
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sameOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  // Origin check for CSRF prevention on state-changing API
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.nextUrl.protocol;
  if (origin && !sameOrigin(origin, host, protocol)) {
    return NextResponse.json(
      { ok: false, error: "Invalid request origin." },
      { status: 403 },
    );
  }

  // Fast-path: If caller presents an unexpired, cryptographically valid access token cookie,
  // return it directly so client in-memory state is restored without rotating refresh token
  const currentAccessToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const verifiedCurrent = currentAccessToken ? verifyAdminAccessToken(currentAccessToken) : null;
  if (verifiedCurrent) {
    return NextResponse.json({
      ok: true,
      access_token: currentAccessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SEC,
    });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  const rateLimit = checkRateLimit(`refresh:${ip}`, 30, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many refresh attempts. Please slow down." },
      { status: 429 },
    );
  }

  // Extract raw refresh token from HttpOnly cookie or fallback JSON body
  const cookieToken = request.cookies.get(ADMIN_REFRESH_COOKIE_NAME)?.value;
  let bodyToken: string | undefined;
  if (!cookieToken) {
    try {
      const body = await request.json();
      bodyToken = typeof body?.refresh_token === "string" ? body.refresh_token : undefined;
    } catch {
      /* ignore */
    }
  }

  const rawOldToken = cookieToken || bodyToken;
  if (!rawOldToken || typeof rawOldToken !== "string" || rawOldToken.length < 20) {
    return NextResponse.json(
      { ok: false, error: "Refresh token is missing or malformed." },
      { status: 401 },
    );
  }

  const oldTokenHash = hashRefreshToken(rawOldToken);
  const { rawToken: rawNewToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } =
    generateRefreshToken();
  const userAgent = request.headers.get("user-agent") || "";

  const rotation = await rotateAdminSession(
    oldTokenHash,
    newTokenHash,
    newExpiresAt.getTime(),
    userAgent,
    ip,
  );

  const isProduction = process.env.NODE_ENV === "production";

  if (!rotation.ok) {
    // If reuse was detected, account disabled, or token invalid/expired, clear client cookies
    const status = rotation.error === "account_disabled" ? 403 : 401;
    const errorMsg =
      rotation.error === "reuse_detected"
        ? "Session revoked due to token reuse. Please sign in again."
        : rotation.error === "account_disabled"
          ? "This administrator account is disabled."
          : "Your session has expired. Please sign in again.";

    const errorResponse = NextResponse.json(
      {
        ok: false,
        error: errorMsg,
        code: rotation.error,
      },
      { status },
    );

    errorResponse.cookies.set(ADMIN_REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 0,
    });
    errorResponse.cookies.set(ADMIN_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 0,
    });

    return errorResponse;
  }

  const adminId = rotation.adminId || "achu";
  const newAccessToken = createAdminAccessToken({
    id: adminId,
    email: "achu@achuboutique.com",
    role: "admin",
  });

  const response = NextResponse.json({
    ok: true,
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SEC,
  });

  // Rotate HttpOnly refresh cookie
  response.cookies.set(ADMIN_REFRESH_COOKIE_NAME, rawNewToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });

  // Rotate access token cookie for SSR
  response.cookies.set(ADMIN_COOKIE_NAME, newAccessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });

  return response;
}
