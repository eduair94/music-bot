/** Discord snowflake: 17–20 decimal digits. */
export function isSnowflake(id: unknown): id is string {
  return typeof id === "string" && /^\d{17,20}$/.test(id);
}

/**
 * CSRF guard for state-changing admin routes. Browsers send Sec-Fetch-Site on
 * every request; when absent we require an Origin whose host matches ours.
 */
export function isSameOrigin(headers: Headers, requestHost: string | null): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = headers.get("origin");
  if (!origin || !requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

/** Sliding-window in-memory limiter (per Next.js server instance). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  allow(key: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
