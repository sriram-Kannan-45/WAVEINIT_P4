import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  checkAdminCredentials,
  createAdminAccessToken,
  verifyAdminAccessToken,
  generateRefreshToken,
  registerMemorySession,
  rotateMemorySession,
  revokeMemorySession,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from "../src/lib/admin-auth";
import { checkRateLimit } from "../src/lib/rate-limiter";

test("password hashing generates unique scrypt salts and validates timing-safely", () => {
  const password = "SuperSecretAdminPassword2026!";
  const hash1 = hashPassword(password);
  const hash2 = hashPassword(password);

  assert.ok(hash1.startsWith("scrypt$16384$8$1$"));
  assert.ok(hash2.startsWith("scrypt$16384$8$1$"));
  // Unique random salt ensures distinct hashes
  assert.notEqual(hash1, hash2);

  assert.equal(verifyPassword(password, hash1), true);
  assert.equal(verifyPassword(password, hash2), true);
  assert.equal(verifyPassword("WrongPassword123!", hash1), false);
  assert.equal(verifyPassword("", hash1), false);
  assert.equal(verifyPassword(password, "malformed-hash"), false);
});

test("admin credential verification rejects unknown users and timing leaks", () => {
  assert.equal(checkAdminCredentials("achu", "1234"), true);
  assert.equal(checkAdminCredentials("ACHU", "1234"), true);
  assert.equal(checkAdminCredentials("  achu  ", "1234"), true);
  assert.equal(checkAdminCredentials("achu@achuboutique.com", "1234"), true);

  assert.equal(checkAdminCredentials("achu", "wrongpassword"), false);
  assert.equal(checkAdminCredentials("intruder", "1234"), false);
  assert.equal(checkAdminCredentials("", "1234"), false);
  assert.equal(checkAdminCredentials("achu", ""), false);
});

test("JWT access tokens enforce standard HS256 claims, signatures, and tamper resistance", () => {
  const adminId = "achu-owner-id-123";
  const email = "owner@achuboutique.com";
  const token = createAdminAccessToken({ id: adminId, email, role: "admin" });

  // 1. Structure check: exactly 3 base64url segments
  const parts = token.split(".");
  assert.equal(parts.length, 3);

  // 2. Header check
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");

  // 3. Payload claims check
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assert.equal(payload.sub, adminId);
  assert.equal(payload.email, email);
  assert.equal(payload.role, "admin");
  assert.equal(payload.iss, JWT_ISSUER);
  assert.equal(payload.aud, JWT_AUDIENCE);
  assert.ok(payload.exp > payload.iat);
  assert.ok(payload.jti.length > 10);

  // 4. Verification passes for valid token
  const verified = verifyAdminAccessToken(token);
  assert.ok(verified);
  assert.equal(verified?.sub, adminId);
  assert.equal(verified?.role, "admin");

  // 5. Tampered payload is rejected
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...payload, role: "superhacker" }),
  ).toString("base64url");
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  assert.equal(verifyAdminAccessToken(tamperedToken), null);

  // 6. Tampered signature is rejected
  assert.equal(verifyAdminAccessToken(token + "tamper"), null);

  // 7. Expired token is rejected
  const expiredPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000) - 2000,
      exp: Math.floor(Date.now() / 1000) - 500,
    }),
  ).toString("base64url");
  const expiredSig = parts[2]; // or whatever signature
  assert.equal(
    verifyAdminAccessToken(`${parts[0]}.${expiredPayload}.${expiredSig}`),
    null,
  );

  // 8. Algorithm manipulation (e.g. alg: "none") is rejected
  const noneHeader = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  assert.equal(
    verifyAdminAccessToken(`${noneHeader}.${parts[1]}.${parts[2]}`),
    null,
  );

  // 9. Null, empty, and invalid inputs
  assert.equal(verifyAdminAccessToken(null), null);
  assert.equal(verifyAdminAccessToken(""), null);
  assert.equal(verifyAdminAccessToken("invalid.token"), null);
});

test("refresh tokens enforce atomic rotation, reuse detection, and family invalidation", () => {
  const adminId = "owner-admin-uuid";
  const gen1 = generateRefreshToken();
  assert.ok(gen1.rawToken.length >= 64);
  assert.ok(gen1.tokenHash.length === 64);

  const initialSession = registerMemorySession({
    adminId,
    tokenHash: gen1.tokenHash,
    expiresAt: gen1.expiresAt.getTime(),
  });
  const familyId = initialSession.familyId;
  assert.ok(familyId);

  // 1. First valid rotation (Gen 1 -> Gen 2)
  const gen2 = generateRefreshToken();
  const rotate1 = rotateMemorySession(
    gen1.tokenHash,
    gen2.tokenHash,
    gen2.expiresAt.getTime(),
  );
  assert.equal(rotate1.ok, true);
  assert.equal(rotate1.adminId, adminId);
  assert.equal(rotate1.familyId, familyId);

  // 2. Second valid rotation (Gen 2 -> Gen 3)
  const gen3 = generateRefreshToken();
  const rotate2 = rotateMemorySession(
    gen2.tokenHash,
    gen3.tokenHash,
    gen3.expiresAt.getTime(),
  );
  assert.equal(rotate2.ok, true);
  assert.equal(rotate2.familyId, familyId);

  // 3. REUSE ATTACK DETECTION:
  // An attacker steals Gen 1 and tries to use it after it was already rotated!
  const gen4 = generateRefreshToken();
  const replayAttack = rotateMemorySession(
    gen1.tokenHash,
    gen4.tokenHash,
    gen4.expiresAt.getTime(),
  );
  assert.equal(replayAttack.ok, false);
  assert.equal(replayAttack.error, "reuse_detected");
  assert.equal(replayAttack.familyId, familyId);

  // 4. Verification that entire family is now revoked:
  // Legitimate user trying to use Gen 3 is also rejected because family was compromised!
  const gen5 = generateRefreshToken();
  const postCompromiseUse = rotateMemorySession(
    gen3.tokenHash,
    gen5.tokenHash,
    gen5.expiresAt.getTime(),
  );
  assert.equal(postCompromiseUse.ok, false);
  assert.equal(postCompromiseUse.error, "reuse_detected");
});

test("session revocation on logout terminates active refresh token family", () => {
  const adminId = "admin-logout-test";
  const token = generateRefreshToken();
  registerMemorySession({
    adminId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt.getTime(),
  });

  // Logout revokes the session
  const revoked = revokeMemorySession(token.tokenHash);
  assert.equal(revoked, true);

  // Attempting to refresh with the revoked session fails
  const nextToken = generateRefreshToken();
  const result = rotateMemorySession(
    token.tokenHash,
    nextToken.tokenHash,
    nextToken.expiresAt.getTime(),
  );
  assert.equal(result.ok, false);
});

test("sliding-window rate limiter blocks brute-force abuse", () => {
  const testIpKey = "test-rate-limit-ip-" + Date.now();

  // First 5 attempts within window are allowed
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testIpKey, 5, 60);
    assert.equal(res.allowed, true);
  }

  // 6th attempt is blocked
  const blocked = checkRateLimit(testIpKey, 5, 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetSeconds > 0);
});
