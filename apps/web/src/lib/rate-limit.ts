/**
 * In-memory per-user rate limit for API routes.
 * For production at scale, use Redis or similar.
 */
const windowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 30;
const store = new Map<string, { count: number; resetAt: number }>();

function getKey(userId: string): string {
  return `user:${userId}`;
}

export function checkRateLimit(userId: string): { allowed: boolean } {
  const now = Date.now();
  const key = getKey(userId);
  let entry = store.get(key);
  if (!entry) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true };
  }
  if (now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true };
  }
  entry.count += 1;
  if (entry.count > maxRequestsPerWindow) {
    return { allowed: false };
  }
  return { allowed: true };
}
