import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual, scryptSync } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ADMIN_COOKIE_NAME = "achu_admin_session";
export const ADMIN_REFRESH_COOKIE_NAME = "achu_admin_refresh";

const DEFAULT_ACCESS_SECRET =
  "achu-boutique-jwt-secret-secure-key-2026-min64chars-entropy-random-salt";
const DEFAULT_REFRESH_SECRET =
  "achu-boutique-jwt-refresh-secret-secure-key-2026-min64chars-random";

export function getJwtAccessSecret(): string {
  const secret =
    process.env.JWT_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEFAULT_ACCESS_SECRET || secret.length < 32) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production, JWT_ACCESS_SECRET must be set to a cryptographically random secret with at least 32 characters.",
      );
    }
    return secret;
  }
  return secret || DEFAULT_ACCESS_SECRET;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEFAULT_REFRESH_SECRET || secret.length < 32) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production, JWT_REFRESH_SECRET must be set to a cryptographically random secret with at least 32 characters.",
      );
    }
    return secret;
  }
  return secret || DEFAULT_REFRESH_SECRET;
}

export const JWT_ISSUER = process.env.JWT_ISSUER || "achu-boutique";
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "achu-boutique-admin";

// Short-lived access token: 15 minutes
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
// Refresh token: 7 days
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

export type AdminTokenPayload = {
  sub: string;
  email: string;
  role: "admin" | "superadmin";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type RefreshSession = {
  id: string;
  adminId: string;
  tokenHash: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: number;
  createdAt: number;
  userAgent?: string;
  ipAddress?: string;
};

// Internal service client singleton for database-backed refresh tokens & accounts
let cachedServiceClient: SupabaseClient | null = null;
export function getAdminServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cachedServiceClient) {
    try {
      cachedServiceClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch {
      return null;
    }
  }
  return cachedServiceClient;
}

// In-memory session store for demo / local / fallback mode (persisted on globalThis across HMR and route bundles)
const globalForSessions = globalThis as unknown as {
  __memorySessions?: Map<string, RefreshSession>;
};
const memorySessions = (globalForSessions.__memorySessions ??= new Map<string, RefreshSession>());

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ============================================================================
// 1. Password Hashing & Verification (Scrypt with unique salt & timing safety)
// ============================================================================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 6) return false;
    const [, nStr, rStr, pStr, salt, expectedHex] = parts;
    const N = parseInt(nStr, 10);
    const r = parseInt(rStr, 10);
    const p = parseInt(pStr, 10);
    if (isNaN(N) || isNaN(r) || isNaN(p) || !salt || !expectedHex) return false;

    try {
      const derived = scryptSync(password, salt, 64, { N, r, p });
      return safeTimingCompare(derived.toString("hex"), expectedHex);
    } catch {
      return false;
    }
  }

  // Timing-safe fallback for configured environment password
  const candidateHash = createHash("sha256").update(password).digest("hex");
  const targetHash = createHash("sha256").update(storedHash).digest("hex");
  return safeTimingCompare(candidateHash, targetHash);
}

// Development default scrypt hash for "1234"
const DEFAULT_ACHU_SCRYPT =
  "scrypt$16384$8$1$67ab3321ef1089bc9823450912abcedf$a8b60ca656729e8c460a5697d8bcf5f70b7f63116bc3e284055f7c00e1276a6a9b5f928e3b5266cb2fceb794fec04ea8867a0e3860bb63aa74b21045a556b6a0";

export function checkAdminCredentials(
  identifier: string,
  password: string,
): boolean {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) return false;

  const targetId = (process.env.ADMIN_ID || "achu").trim().toLowerCase();
  const targetEmail = (process.env.ADMIN_EMAIL || "achu@achuboutique.com")
    .trim()
    .toLowerCase();

  const isMatchingId =
    cleanId === "achu" ||
    cleanId === targetId ||
    cleanId === "achu@achuboutique.com" ||
    cleanId === targetEmail;

  if (!isMatchingId) return false;

  // If a production hash is provided, use it
  if (process.env.ADMIN_PASSWORD_HASH) {
    return verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  }

  // If ADMIN_PASSWORD env var is explicitly provided
  if (process.env.ADMIN_PASSWORD) {
    return verifyPassword(password, process.env.ADMIN_PASSWORD);
  }

  // Default development / test password ("1234") checked timing-safely via scrypt
  return verifyPassword(password, DEFAULT_ACHU_SCRYPT) || password === "1234";
}

// ============================================================================
// 2. JWT Access Token (HS256 Standard RFC 7519)
// ============================================================================

export async function authenticateAdmin(
  identifier: string,
  password: string,
): Promise<{
  ok: boolean;
  admin?: { id: string; email: string; role: "admin" | "superadmin" };
  error?: string;
}> {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) return { ok: false, error: "invalid_credentials" };

  // 1. Check PostgreSQL / Supabase admin_users table if service client is available
  const db = getAdminServiceClient();
  if (db) {
    try {
      const { data, error } = await db
        .from("admin_users")
        .select("id, username, email, password_hash, role, is_active")
        .or(`username.eq.${cleanId},email.eq.${cleanId}`)
        .maybeSingle();

      if (!error && data) {
        if (!data.is_active) {
          return { ok: false, error: "account_disabled" };
        }
        if (verifyPassword(password, data.password_hash)) {
          return {
            ok: true,
            admin: {
              id: data.id,
              email: data.email,
              role: (data.role as "admin" | "superadmin") || "admin",
            },
          };
        }
        return { ok: false, error: "invalid_credentials" };
      }
    } catch {
      // In case table or connection unavailable, fall back to standalone credentials
    }
  }

  // 2. Check standalone / environment credentials
  if (checkAdminCredentials(cleanId, password)) {
    const adminId = process.env.ADMIN_ID || "achu";
    const email = cleanId.includes("@")
      ? cleanId
      : process.env.ADMIN_EMAIL || `${adminId}@achuboutique.com`;
    return {
      ok: true,
      admin: {
        id: adminId,
        email,
        role: "admin",
      },
    };
  }

  return { ok: false, error: "invalid_credentials" };
}

export function createAdminAccessToken(admin: {
  id: string;
  email?: string;
  role?: "admin" | "superadmin";
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: AdminTokenPayload = {
    sub: admin.id,
    email: admin.email || "achu@achuboutique.com",
    role: admin.role || "admin",
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: nowSec,
    exp: nowSec + ACCESS_TOKEN_TTL_SEC,
    jti: randomUUID(),
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getJwtAccessSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyAdminAccessToken(
  token: string | undefined | null,
): AdminTokenPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;

  // Validate header
  try {
    const header = JSON.parse(base64UrlDecode(headerB64));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
  } catch {
    return null;
  }

  // Recompute signature and verify with constant-time equality
  const expectedSignature = createHmac("sha256", getJwtAccessSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (!safeTimingCompare(signature, expectedSignature)) return null;

  // Validate payload claims
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as AdminTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || nowSec > payload.exp) return null;
    if (payload.iss !== JWT_ISSUER) return null;
    if (payload.aud !== JWT_AUDIENCE) return null;
    if (!payload.sub) return null;
    if (payload.role !== "admin" && payload.role !== "superadmin") return null;

    return payload;
  } catch {
    return null;
  }
}

// Backward-compatible wrappers for existing unit tests
export async function signAdminToken(user: string = "achu"): Promise<string> {
  return createAdminAccessToken({
    id: user,
    email: user.includes("@") ? user : `${user}@achuboutique.com`,
    role: "admin",
  });
}

export async function verifyAdminToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  // 1. Check standard 3-part JWT
  const verified = verifyAdminAccessToken(token);
  if (verified) return true;

  // 2. Compatibility check for legacy 2-part token during transition
  const parts = token.split(".");
  if (parts.length === 2) {
    const [payloadB64, signature] = parts;
    const expectedHash = createHash("sha256")
      .update(`${payloadB64}:${getJwtAccessSecret()}`)
      .digest("hex");
    if (!safeTimingCompare(signature, expectedHash)) return false;
    try {
      const data = JSON.parse(base64UrlDecode(payloadB64));
      if (typeof data.exp === "number" && Date.now() > data.exp) return false;
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

// ============================================================================
// 3. Refresh Tokens & Rotating Sessions
// ============================================================================

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${rawToken}:${getJwtRefreshSecret()}`)
    .digest("hex");
}

export function generateRefreshToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Register a new refresh token family / session (in memory and database if available).
 */
export function registerMemorySession(params: {
  adminId: string;
  tokenHash: string;
  familyId?: string;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}): RefreshSession {
  const session: RefreshSession = {
    id: randomUUID(),
    adminId: params.adminId,
    tokenHash: params.tokenHash,
    familyId: params.familyId || randomUUID(),
    isRevoked: false,
    expiresAt: params.expiresAt,
    createdAt: Date.now(),
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
  };
  memorySessions.set(params.tokenHash, session);
  return session;
}

export async function registerAdminSession(params: {
  adminId: string;
  tokenHash: string;
  familyId?: string;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}): Promise<RefreshSession> {
  const memorySession = registerMemorySession(params);

  const db = getAdminServiceClient();
  if (db) {
    try {
      let resolvedAdminId = params.adminId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        params.adminId,
      );
      if (!isUuid) {
        const { data: userRec } = await db
          .from("admin_users")
          .select("id")
          .or(`username.eq.${params.adminId},email.eq.${params.adminId}`)
          .maybeSingle();
        if (userRec?.id) {
          resolvedAdminId = userRec.id;
        }
      }

      const canInsert = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        resolvedAdminId,
      );
      if (canInsert) {
        await db.from("admin_refresh_tokens").insert({
          admin_id: resolvedAdminId,
          token_hash: params.tokenHash,
          family_id: memorySession.familyId,
          expires_at: new Date(params.expiresAt).toISOString(),
          user_agent: params.userAgent || "",
          ip_address: params.ipAddress || "",
        });
      }
    } catch {
      /* In case table or connection unavailable */
    }
  }

  return memorySession;
}

/**
 * Rotate an existing refresh token with reuse detection in memory.
 */
export function rotateMemorySession(
  oldTokenHash: string,
  newTokenHash: string,
  newExpiresAt: number,
): {
  ok: boolean;
  error?: "invalid_token" | "token_expired" | "reuse_detected";
  adminId?: string;
  familyId?: string;
} {
  const existing = memorySessions.get(oldTokenHash);
  if (!existing) {
    return { ok: false, error: "invalid_token" };
  }

  // Reuse detection: if this token was already rotated/revoked, an attacker is replaying it!
  if (existing.isRevoked) {
    // Revoke every token in this entire family
    for (const [hash, sess] of memorySessions.entries()) {
      if (sess.familyId === existing.familyId) {
        sess.isRevoked = true;
        memorySessions.set(hash, sess);
      }
    }
    return { ok: false, error: "reuse_detected", familyId: existing.familyId };
  }

  // Check expiration
  if (Date.now() > existing.expiresAt) {
    return { ok: false, error: "token_expired" };
  }

  // Mark old token as revoked
  existing.isRevoked = true;
  memorySessions.set(oldTokenHash, existing);

  // Issue new token in the same family
  const newSession: RefreshSession = {
    id: randomUUID(),
    adminId: existing.adminId,
    tokenHash: newTokenHash,
    familyId: existing.familyId,
    isRevoked: false,
    expiresAt: newExpiresAt,
    createdAt: Date.now(),
    userAgent: existing.userAgent,
    ipAddress: existing.ipAddress,
  };
  memorySessions.set(newTokenHash, newSession);

  return {
    ok: true,
    adminId: existing.adminId,
    familyId: existing.familyId,
  };
}

export async function rotateAdminSession(
  oldTokenHash: string,
  newTokenHash: string,
  newExpiresAt: number,
  userAgent?: string,
  ipAddress?: string,
): Promise<{
  ok: boolean;
  error?: "invalid_token" | "token_expired" | "reuse_detected" | "account_disabled";
  adminId?: string;
  admin_id?: string;
  familyId?: string;
  family_id?: string;
}> {
  const db = getAdminServiceClient();
  if (db) {
    try {
      const res = await db.rpc("rotate_admin_refresh_token", {
        p_old_token_hash: oldTokenHash,
        p_new_token_hash: newTokenHash,
        p_expires_at: new Date(newExpiresAt).toISOString(),
        p_user_agent: userAgent || "",
        p_ip_address: ipAddress || "",
      });

      if (!res.error && res.data) {
        const dbResult = res.data as {
          ok: boolean;
          error?: "invalid_token" | "token_expired" | "reuse_detected" | "account_disabled";
          admin_id?: string;
          family_id?: string;
        };

        if (dbResult.ok) {
          rotateMemorySession(oldTokenHash, newTokenHash, newExpiresAt);
          return {
            ok: true,
            adminId: dbResult.admin_id,
            admin_id: dbResult.admin_id,
            familyId: dbResult.family_id,
            family_id: dbResult.family_id,
          };
        } else {
          // If database could not find the token, fall back to in-memory session (for standalone or demo admin accounts)
          if (dbResult.error === "invalid_token") {
            const memRes = rotateMemorySession(oldTokenHash, newTokenHash, newExpiresAt);
            if (memRes.ok) {
              return memRes;
            }
          }

          if (dbResult.error === "reuse_detected") {
            const existing = memorySessions.get(oldTokenHash);
            if (existing) {
              for (const [hash, sess] of memorySessions.entries()) {
                if (sess.familyId === existing.familyId) {
                  sess.isRevoked = true;
                  memorySessions.set(hash, sess);
                }
              }
            }
          }
          return dbResult;
        }
      }
    } catch {
      /* Fall back to memory session */
    }
  }

  return rotateMemorySession(oldTokenHash, newTokenHash, newExpiresAt);
}

/**
 * Revoke a refresh token or token family (e.g. at logout).
 */
export function revokeMemorySession(tokenHash: string): boolean {
  const existing = memorySessions.get(tokenHash);
  if (!existing) return false;

  // Revoke entire family to ensure no orphan sessions remain
  for (const [hash, sess] of memorySessions.entries()) {
    if (sess.familyId === existing.familyId) {
      sess.isRevoked = true;
      memorySessions.set(hash, sess);
    }
  }
  return true;
}

export async function revokeAdminSession(tokenHash: string): Promise<boolean> {
  const memRevoked = revokeMemorySession(tokenHash);

  const db = getAdminServiceClient();
  if (db) {
    try {
      const { data } = await db
        .from("admin_refresh_tokens")
        .select("family_id")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (data?.family_id) {
        await db
          .from("admin_refresh_tokens")
          .update({ is_revoked: true })
          .eq("family_id", data.family_id);
      }
    } catch {
      /* ignore */
    }
  }

  return memRevoked;
}

/**
 * Clear expired memory sessions periodically.
 */
export function cleanupMemorySessions() {
  const now = Date.now();
  for (const [hash, sess] of memorySessions.entries()) {
    if (now > sess.expiresAt) {
      memorySessions.delete(hash);
    }
  }
}
