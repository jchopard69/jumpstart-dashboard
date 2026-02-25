/**
 * LinkedIn Marketing API configuration
 */

export const LINKEDIN_CONFIG = {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  apiUrl: 'https://api.linkedin.com/rest',
  apiV2Url: 'https://api.linkedin.com/v2',

  // OAuth scopes (Community Management / Organizations)
  // See: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations
  // Pages Data Portability API (DMA) — single scope for read-only page analytics
  scopes: [
    'r_dma_admin_pages_content'
  ],
};

// Default LinkedIn API version (YYYYMM format).
// LinkedIn REST API requires the LinkedIn-Version header for DMA endpoints.
const DEFAULT_LINKEDIN_VERSION = '202501';
// Optional env fallbacks used by the connector:
// - LINKEDIN_FOLLOWER_OVERRIDES: one entry per line/semicolon, format `orgId=4434`.
// - LINKEDIN_ENABLE_PUBLIC_FOLLOWER_FALLBACK: set to `0` to disable public-page fallback.

export function getLinkedInVersion(): string {
  const raw = (process.env.LINKEDIN_VERSION || '').trim();
  if (!raw || raw.toLowerCase() === 'auto') return DEFAULT_LINKEDIN_VERSION;
  // Normalize to YYYYMM to avoid accidental YYYYMMDD values from envs.
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }
  return digits.length ? digits : raw;
}

export function getLinkedInConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/linkedin/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth not configured: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are required');
  }

  return {
    ...LINKEDIN_CONFIG,
    clientId,
    clientSecret,
    redirectUri,
    version: getLinkedInVersion(),
  };
}
