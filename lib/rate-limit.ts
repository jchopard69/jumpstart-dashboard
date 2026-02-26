type RateLimitOptions = {
  max: number;
  windowMs: number;
  blockMs?: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = {
  count: number;
  windowStart: number;
  blockedUntil: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    const expiredWindow = now - bucket.windowStart > 60 * 60 * 1000;
    const unblocked = bucket.blockedUntil <= now;
    if (expiredWindow && unblocked) {
      buckets.delete(key);
    }
    if (buckets.size < MAX_BUCKETS) break;
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  pruneBuckets(now);
  const current = buckets.get(key);

  if (!current) {
    buckets.set(key, {
      count: 1,
      windowStart: now,
      blockedUntil: 0,
    });
    return { allowed: true, remaining: Math.max(0, options.max - 1), retryAfterMs: 0 };
  }

  if (current.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: current.blockedUntil - now,
    };
  }

  if (now - current.windowStart >= options.windowMs) {
    current.count = 1;
    current.windowStart = now;
    current.blockedUntil = 0;
    buckets.set(key, current);
    return { allowed: true, remaining: Math.max(0, options.max - 1), retryAfterMs: 0 };
  }

  current.count += 1;
  if (current.count > options.max) {
    const retryAfterMs = options.blockMs ?? options.windowMs - (now - current.windowStart);
    current.blockedUntil = now + retryAfterMs;
    buckets.set(key, current);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  buckets.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(0, options.max - current.count),
    retryAfterMs: 0,
  };
}

