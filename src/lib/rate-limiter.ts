type RateLimitRecord = {
  timestamps: number[];
};

const store = new Map<string, RateLimitRecord>();

/**
 * Clean up old rate limit records periodically
 */
function cleanupStore() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    // Keep timestamps from the last 15 minutes
    record.timestamps = record.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

let lastCleanup = Date.now();

/**
 * Check and consume a rate limit token using a sliding window.
 * @param key unique identifier (e.g. "login:127.0.0.1")
 * @param maxAttempts maximum attempts in window
 * @param windowSeconds window duration in seconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 600,
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();

  if (now - lastCleanup > 60 * 1000) {
    cleanupStore();
    lastCleanup = now;
  }

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  const windowMs = windowSeconds * 1000;
  // Retain only timestamps within the current window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxAttempts) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxAttempts - record.timestamps.length,
    resetSeconds: windowSeconds,
  };
}
