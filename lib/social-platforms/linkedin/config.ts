/**
 * LinkedIn Community Management API configuration.
 * Based on the Marketing API 2026-03 documentation.
 */

export const DEFAULT_LINKEDIN_VERSION = "202603";

export const LINKEDIN_CONFIG = {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  apiUrl: 'https://api.linkedin.com/rest',
  apiV2Url: 'https://api.linkedin.com/v2',

  // Community Management / Organizations scopes.
  scopes: [
    'r_organization_admin',
    'rw_organization_admin',
    'r_organization_social',
  ],
};

export function getLinkedInVersion(): string {
  const raw = (process.env.LINKEDIN_VERSION || '').trim();
  if (!raw || raw.toLowerCase() === 'auto') {
    return DEFAULT_LINKEDIN_VERSION;
  }
  // Normalize to YYYYMM to avoid accidental YYYYMMDD values from envs.
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }
  return digits.length ? digits : DEFAULT_LINKEDIN_VERSION;
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
