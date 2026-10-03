export function sameOrigin(
  origin: string | null,
  host: string | null,
  protocol: string,
) {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === `${protocol}//${host.toLowerCase()}`;
  } catch {
    return false;
  }
}
