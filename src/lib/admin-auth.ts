export const ADMIN_COOKIE_NAME = "achu_admin_session";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "achu-boutique-secret-salt-2026";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function checkAdminCredentials(
  identifier: string,
  password: string,
): boolean {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId) return false;

  const targetId = (process.env.ADMIN_ID || "achu").trim().toLowerCase();
  const targetEmail = (process.env.ADMIN_EMAIL || "achu@achuboutique.com")
    .trim()
    .toLowerCase();
  const targetPassword = process.env.ADMIN_PASSWORD || "1234";

  const isMatchingId =
    cleanId === "achu" ||
    cleanId === targetId ||
    cleanId === "achu@achuboutique.com" ||
    cleanId === targetEmail;

  return isMatchingId && password === targetPassword;
}

export async function signAdminToken(user: string = "achu"): Promise<string> {
  const payload = {
    user,
    role: "admin",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadB64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(jsonStr).toString("base64url")
      : btoa(jsonStr)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
  const hash = await sha256Hex(`${payloadB64}:${AUTH_SECRET}`);
  return `${payloadB64}.${hash}`;
}

export async function verifyAdminToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  const expectedHash = await sha256Hex(`${payloadB64}:${AUTH_SECRET}`);
  if (signature !== expectedHash) return false;

  try {
    const jsonStr =
      typeof Buffer !== "undefined"
        ? Buffer.from(payloadB64, "base64url").toString("utf-8")
        : atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(jsonStr);
    if (typeof data.exp === "number" && Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}
