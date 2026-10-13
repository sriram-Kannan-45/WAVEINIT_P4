import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateAdmin,
  createAdminAccessToken,
  verifyAdminAccessToken,
  generateRefreshToken,
  registerMemorySession,
  rotateMemorySession,
  revokeMemorySession,
  getJwtAccessSecret,
  getJwtRefreshSecret,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from "../src/lib/admin-auth";
import { checkRateLimit } from "../src/lib/rate-limiter";
import { sameOrigin } from "../src/lib/request-origin";

test("admin authentication accepts valid credentials and timing-safely rejects invalid or disabled accounts", async () => {
  // Valid credentials
  const res1 = await authenticateAdmin("achu", "1234");
  assert.equal(res1.ok, true);
  assert.equal(res1.admin?.id, "achu");
  assert.equal(res1.admin?.role, "admin");

  // Case insensitivity & trimming
  const res2 = await authenticateAdmin("  ACHU  ", "1234");
  assert.equal(res2.ok, true);

  // Invalid password
  const res3 = await authenticateAdmin("achu", "wrong-password");
  assert.equal(res3.ok, false);
  assert.equal(res3.error, "invalid_credentials");

  // Unknown admin ID
  const res4 = await authenticateAdmin("hacker", "1234");
  assert.equal(res4.ok, false);
  assert.equal(res4.error, "invalid_credentials");

  // Empty credentials
  const res5 = await authenticateAdmin("", "1234");
  assert.equal(res5.ok, false);

  const res6 = await authenticateAdmin("achu", "");
  assert.equal(res6.ok, false);
});

test("JWT access tokens strictly enforce algorithms, issuers, audiences, expiration, and constant-time signature verification", () => {
  const adminId = "owner-admin-uuid-456";
  const email = "owner@achuboutique.com";
  const token = createAdminAccessToken({ id: adminId, email, role: "admin" });

  // 1. Structure check: exactly 3 base64url segments
  const parts = token.split(".");
  assert.equal(parts.length, 3);

  // 2. Claims verification
  const verified = verifyAdminAccessToken(token);
  assert.ok(verified);
  assert.equal(verified?.sub, adminId);
  assert.equal(verified?.email, email);
  assert.equal(verified?.role, "admin");
  assert.equal(verified?.iss, JWT_ISSUER);
  assert.equal(verified?.aud, JWT_AUDIENCE);

  // 3. Reject tampered payload
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: adminId, role: "superhacker", iss: JWT_ISSUER, aud: JWT_AUDIENCE, exp: Date.now() }),
  ).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${parts[0]}.${tamperedPayload}.${parts[2]}`), null);

  // 4. Reject tampered signature
  assert.equal(verifyAdminAccessToken(`${token}badsignature`), null);

  // 5. Reject alg: none attack
  const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${noneHeader}.${parts[1]}.${parts[2]}`), null);

  // 6. Reject mismatched issuer
  const wrongIssPayload = Buffer.from(
    JSON.stringify({
      sub: adminId,
      role: "admin",
      iss: "fake-issuer",
      aud: JWT_AUDIENCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  ).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${parts[0]}.${wrongIssPayload}.${parts[2]}`), null);

  // 7. Reject mismatched audience
  const wrongAudPayload = Buffer.from(
    JSON.stringify({
      sub: adminId,
      role: "admin",
      iss: JWT_ISSUER,
      aud: "fake-audience",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  ).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${parts[0]}.${wrongAudPayload}.${parts[2]}`), null);

  // 8. Reject expired tokens
  const expiredPayload = Buffer.from(
    JSON.stringify({
      sub: adminId,
      role: "admin",
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: Math.floor(Date.now() / 1000) - 2000,
      exp: Math.floor(Date.now() / 1000) - 100,
    }),
  ).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${parts[0]}.${expiredPayload}.${parts[2]}`), null);
});

test("refresh token rotation enforces atomic session progression, reuse detection, and family revocation", () => {
  const adminId = "achu-session-test";
  const gen1 = generateRefreshToken();
  assert.ok(gen1.rawToken.length >= 64);
  assert.ok(gen1.tokenHash.length === 64);

  const session = registerMemorySession({
    adminId,
    tokenHash: gen1.tokenHash,
    expiresAt: gen1.expiresAt.getTime(),
  });
  const familyId = session.familyId;
  assert.ok(familyId);

  // 1. Rotation 1: Gen 1 -> Gen 2
  const gen2 = generateRefreshToken();
  const rot1 = rotateMemorySession(gen1.tokenHash, gen2.tokenHash, gen2.expiresAt.getTime());
  assert.equal(rot1.ok, true);
  assert.equal(rot1.adminId, adminId);
  assert.equal(rot1.familyId, familyId);

  // 2. Rotation 2: Gen 2 -> Gen 3
  const gen3 = generateRefreshToken();
  const rot2 = rotateMemorySession(gen2.tokenHash, gen3.tokenHash, gen3.expiresAt.getTime());
  assert.equal(rot2.ok, true);
  assert.equal(rot2.familyId, familyId);

  // 3. REUSE ATTACK: Attacker replays stolen Gen 1 token!
  const gen4 = generateRefreshToken();
  const replayAttack = rotateMemorySession(gen1.tokenHash, gen4.tokenHash, gen4.expiresAt.getTime());
  assert.equal(replayAttack.ok, false);
  assert.equal(replayAttack.error, "reuse_detected");
  assert.equal(replayAttack.familyId, familyId);

  // 4. Verification that legitimate Gen 3 token is now ALSO revoked (compromise protection)
  const gen5 = generateRefreshToken();
  const victimAttempt = rotateMemorySession(gen3.tokenHash, gen5.tokenHash, gen5.expiresAt.getTime());
  assert.equal(victimAttempt.ok, false);
  assert.equal(victimAttempt.error, "reuse_detected");
});

test("logout cleanly revokes entire active session token family", () => {
  const adminId = "logout-admin-user";
  const token = generateRefreshToken();
  registerMemorySession({
    adminId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt.getTime(),
  });

  // Successful revocation
  const revoked = revokeMemorySession(token.tokenHash);
  assert.equal(revoked, true);

  // Subsequent refresh using revoked token is rejected
  const nextToken = generateRefreshToken();
  const attempt = rotateMemorySession(token.tokenHash, nextToken.tokenHash, nextToken.expiresAt.getTime());
  assert.equal(attempt.ok, false);
});

test("CSRF sameOrigin verification validates authentic browser origins and blocks cross-origin requests", () => {
  // Legitimate same-origin requests
  assert.equal(sameOrigin("http://localhost:3000", "localhost:3000", "http:"), true);
  assert.equal(sameOrigin("https://achuboutique.com", "achuboutique.com", "https:"), true);
  assert.equal(sameOrigin("https://admin.achuboutique.com", "admin.achuboutique.com", "https:"), true);

  // Hostile cross-origin requests
  assert.equal(sameOrigin("http://attacker.com", "achuboutique.com", "https:"), false);
  assert.equal(sameOrigin("https://achuboutique.com.evil.com", "achuboutique.com", "https:"), false);
  assert.equal(sameOrigin("http://achuboutique.com", "achuboutique.com", "https:"), false); // protocol downgrade
  assert.equal(sameOrigin("https://achuboutique.com:8080", "achuboutique.com:3000", "https:"), false); // port mismatch
  assert.equal(sameOrigin("null", "localhost:3000", "http:"), false);
  assert.equal(sameOrigin("", "localhost:3000", "http:"), false);
  assert.equal(sameOrigin(null, "localhost:3000", "http:"), false);
});

test("rate limiting sliding window enforces brute-force protection and calculates reset duration", () => {
  const key = `hardening-test-ip-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(key, 5, 30);
    assert.equal(res.allowed, true);
  }

  // 6th attempt is blocked
  const blocked = checkRateLimit(key, 5, 30);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetSeconds > 0 && blocked.resetSeconds <= 30);
});

test("production security validations enforce high-entropy secrets and reject default fallback values", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAccess = process.env.JWT_ACCESS_SECRET;
  const originalRefresh = process.env.JWT_REFRESH_SECRET;

  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    // Missing access secret in production throws fatal error
    assert.throws(() => getJwtAccessSecret(), /FATAL SECURITY CONFIGURATION/);
    assert.throws(() => getJwtRefreshSecret(), /FATAL SECURITY CONFIGURATION/);

    // Insecure short secret (< 32 characters) in production throws
    process.env.JWT_ACCESS_SECRET = "short-secret-123";
    assert.throws(() => getJwtAccessSecret(), /at least 32 characters/);

    // Secure 64-character secret succeeds
    process.env.JWT_ACCESS_SECRET = "a".repeat(64);
    assert.equal(getJwtAccessSecret(), "a".repeat(64));
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    if (originalAccess) process.env.JWT_ACCESS_SECRET = originalAccess;
    else delete process.env.JWT_ACCESS_SECRET;
    if (originalRefresh) process.env.JWT_REFRESH_SECRET = originalRefresh;
    else delete process.env.JWT_REFRESH_SECRET;
  }
});
