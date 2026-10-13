import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminAccessToken,
  ADMIN_COOKIE_NAME,
  getAdminServiceClient,
} from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  // 1. Check Bearer token
  const authHeader = request.headers.get("authorization");
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  // 2. Fallback to access cookie
  if (!token) {
    token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const payload = verifyAdminAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Invalid or expired token" },
      { status: 401 },
    );
  }

  // Check account status if database is available
  const db = getAdminServiceClient();
  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.sub,
      );
      const query = db.from("admin_users").select("is_active");
      const { data } = isUuid
        ? await query.eq("id", payload.sub).maybeSingle()
        : await query.or(`username.eq.${payload.sub},email.eq.${payload.email}`).maybeSingle();

      if (data && !data.is_active) {
        return NextResponse.json(
          { ok: false, error: "This administrator account is disabled." },
          { status: 403 },
        );
      }
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: true,
    admin: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    },
  });
}
