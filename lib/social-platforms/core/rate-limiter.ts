/**
 * Rate limiter for social platform API calls
 * Uses in-memory storage (for single-instance) - can be upgraded to Redis for multi-instance
 */

import { PlatformId, PLATFORM_RATE_LIMITS } from './types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Check if we can make a request without exceeding rate limits
 */
export function checkRateLimit(platform: PlatformId, endpoint: string = 'default'): boolean {
  const key = `${platform}:${endpoint}`;
  const now = Date.now();
  const config = PLATFORM_RATE_LIMITS[platform];

  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get remaining requests for a platform/endpoint
 */
export function getRemainingRequests(platform: PlatformId, endpoint: string = 'default'): number {
  const key = `${platform}:${endpoint}`;
  const now = Date.now();
  const config = PLATFORM_RATE_LIMITS[platform];

  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    return config.maxRequests;
  }

  return Math.max(0, config.maxRequests - entry.count);
}

/**
 * Get time until rate limit resets (in ms)
 */
export function getResetTime(platform: PlatformId, endpoint: string = 'default'): number {
  const key = `${platform}:${endpoint}`;
  const now = Date.now();

  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    return 0;
  }

  return entry.resetAt - now;
}

/**
 * Wait until rate limit allows a request
 */
export async function waitForRateLimit(platform: PlatformId, endpoint: string = 'default'): Promise<void> {
  const resetTime = getResetTime(platform, endpoint);

  if (resetTime > 0) {
    console.log(`[rate-limit] Waiting ${Math.ceil(resetTime / 1000)}s for ${platform}:${endpoint}`);
    await new Promise(resolve => setTimeout(resolve, resetTime + 100)); // Add 100ms buffer
  }
}

/**
 * Execute a function with rate limiting and automatic retry
 */
export async function withRateLimit<T>(
  platform: PlatformId,
  endpoint: string,
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check rate limit
    if (!checkRateLimit(platform, endpoint)) {
      await waitForRateLimit(platform, endpoint);
    }

    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a rate limit error from the API
      const errorMessage = lastError.message.toLowerCase();
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || errorMessage.includes('transient')) {
        console.warn(`[rate-limit] API rate limit hit for ${platform}:${endpoint}, attempt ${attempt + 1}/${maxRetries}`);

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // For other errors, throw immediately
      throw lastError;
    }
  }

  throw lastError || new Error(`Max retries exceeded for ${platform}:${endpoint}`);
}
