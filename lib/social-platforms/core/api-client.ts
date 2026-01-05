/**
 * Universal API client for social platforms with error handling and retry logic
 */

import { PlatformId, ApiError } from './types';
import { withRateLimit } from './rate-limiter';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export class SocialApiError extends Error {
  public platform: PlatformId;
  public endpoint: string;
  public statusCode: number;
  public rawError?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'SocialApiError';
    this.platform = error.platform;
    this.endpoint = error.endpoint;
    this.statusCode = error.statusCode;
    this.rawError = error.rawError;
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Make an API request with rate limiting, retry, and error handling
 */
export async function apiRequest<T>(
  platform: PlatformId,
  url: string,
  options: FetchOptions = {},
  endpoint: string = 'default',
  silentErrors: boolean = false
): Promise<T> {
  return withRateLimit(platform, endpoint, async () => {
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(url, options);
      const responseTime = Date.now() - startTime;

      // Log the request (in production, use proper logging service)
      // Skip logging errors if silentErrors is true and status is an error
      if (!silentErrors || response.ok) {
        console.log(`[${platform}] ${options.method || 'GET'} ${endpoint} - ${response.status} (${responseTime}ms)`);
      }

      if (!response.ok) {
        let errorBody: unknown;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }

        // Parse platform-specific error messages
        const errorMessage = parseErrorMessage(platform, response.status, errorBody);

        throw new SocialApiError({
          platform,
          endpoint,
          statusCode: response.status,
          message: errorMessage,
          rawError: errorBody,
        });
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof SocialApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new SocialApiError({
            platform,
            endpoint,
            statusCode: 408,
            message: `Request timeout for ${platform} API`,
            rawError: error,
          });
        }

        throw new SocialApiError({
          platform,
          endpoint,
          statusCode: 0,
          message: `Network error: ${error.message}`,
          rawError: error,
        });
      }

      throw error;
    }
  });
}

/**
 * Parse platform-specific error messages
 */
function parseErrorMessage(platform: PlatformId, statusCode: number, errorBody: unknown): string {
  if (typeof errorBody === 'string') {
    return errorBody;
  }

  if (typeof errorBody !== 'object' || errorBody === null) {
    return `${platform} API error: ${statusCode}`;
  }

  const body = errorBody as Record<string, unknown>;

  // Meta (Facebook/Instagram) error format
  if (platform === 'facebook' || platform === 'instagram') {
    const error = body.error as Record<string, unknown> | undefined;
    if (error) {
      const message = error.message as string | undefined;
      const code = error.code as number | undefined;
      const subcode = error.error_subcode as number | undefined;
      return `Meta API Error ${code}${subcode ? `.${subcode}` : ''}: ${message || 'Unknown error'}`;
    }
  }

  // TikTok error format
  if (platform === 'tiktok') {
    const error = body.error as Record<string, unknown> | undefined;
    if (error) {
      return `TikTok API Error: ${error.message || error.code || 'Unknown error'}`;
    }
  }

  // YouTube/Google error format
  if (platform === 'youtube') {
    const error = body.error as Record<string, unknown> | undefined;
    if (error) {
      const errors = error.errors as Array<{ message?: string; reason?: string }> | undefined;
      if (errors?.[0]) {
        return `YouTube API Error: ${errors[0].message || errors[0].reason || 'Unknown error'}`;
      }
      return `YouTube API Error: ${error.message || 'Unknown error'}`;
    }
  }

  // Twitter/X error format
  if (platform === 'twitter') {
    const errors = body.errors as Array<{ message?: string; code?: number }> | undefined;
    if (errors?.[0]) {
      return `Twitter API Error ${errors[0].code || ''}: ${errors[0].message || 'Unknown error'}`;
    }
    if (body.error_description) {
      return `Twitter API Error: ${body.error_description}`;
    }
  }

  // LinkedIn error format
  if (platform === 'linkedin') {
    if (body.message) {
      return `LinkedIn API Error: ${body.message}`;
    }
  }

  // Generic fallback
  return `${platform} API error: ${statusCode} - ${JSON.stringify(errorBody).slice(0, 200)}`;
}

/**
 * Build URL with query parameters
 */
export function buildUrl(baseUrl: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}
