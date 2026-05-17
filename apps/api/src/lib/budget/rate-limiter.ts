export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason: string | null;
}

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

export class InMemoryRateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();
  private readonly sweepIntervalMs: number;

  constructor(
    private config: { maxRequests: number; windowMs: number } = { maxRequests: 60, windowMs: 60_000 },
    sweepIntervalMs = 60_000,
  ) {
    this.sweepIntervalMs = sweepIntervalMs;
  }

  private sweep(): void {
    const now = Date.now();
    if (now - this.lastSweep < this.sweepIntervalMs) return;
    this.lastSweep = now;
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) this.windows.delete(key);
    }
  }

  check(key: string): RateLimitResult {
    this.sweep();
    const now = Date.now();
    let entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.config.windowMs };
      this.windows.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count <= this.config.maxRequests;

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      reason: allowed
        ? null
        : `Rate limit exceeded. Try again after ${new Date(entry.resetAt).toISOString()}`,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
