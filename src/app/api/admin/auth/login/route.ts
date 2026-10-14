import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateAdmin,
  createAdminAccessToken,
  generateRefreshToken,
  registerAdminSession,
  ADMIN_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sameOrigin } from "@/lib/request-origin";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  // Origin check for CSRF prevention on state-changing API
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.nextUrl.protocol;
  if (origin && !sameOrigin(origin, host, protocol)) {
    return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  }

  // Rate limiting by client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const isProd = process.env.NODE_ENV === "production";
  const rateLimit = checkRateLimit(`login:${ip}`, isProd ? 5 : 100, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many login attempts. Please wait ${rateLimit.resetSeconds} seconds before trying again.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.resetSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  // Normalize field names (support email, username, or identifier)
  const rawBody = (body || {}) as Record<string, unknown>;
  const parsed = loginSchema.safeParse({
    identifier: String(rawBody.identifier || rawBody.email || rawBody.username || "").trim(),
    password: String(rawBody.password || ""),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "The admin ID or password is incorrect." },
      { status: 401 },
    );
  }

  const { identifier, password } = parsed.data;

  // Verify credentials via database and standalone fallbacks
  const authResult = await authenticateAdmin(identifier, password);
  if (!authResult.ok || !authResult.admin) {
    const errorMsg =
      authResult.error === "account_disabled"
        ? "This administrator account is disabled."
        : "The admin ID or password is incorrect.";
    const status = authResult.error === "account_disabled" ? 403 : 401;
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status },
    );
  }

  const { id: adminId, email, role } = authResult.admin;
  const accessToken = createAdminAccessToken({
    id: adminId,
    email,
    role,
  });

  const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
  const userAgent = request.headers.get("user-agent") || "";
  await registerAdminSession({
    adminId,
    tokenHash,
    expiresAt: expiresAt.getTime(),
    userAgent,
    ipAddress: ip,
  });

  const response = NextResponse.json({
    ok: true,
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SEC,
    admin: {
      id: adminId,
      email,
      role: "admin",
    },
  });

  const isProduction = process.env.NODE_ENV === "production";

  // Set HttpOnly refresh token cookie
  response.cookies.set(ADMIN_REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });

  // Set access token cookie for SSR page navigation
  response.cookies.set(ADMIN_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });

  return response;
}
