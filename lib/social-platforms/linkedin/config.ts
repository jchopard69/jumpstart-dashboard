/**
 * LinkedIn Marketing API configuration
 */

export const LINKEDIN_CONFIG = {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  apiUrl: 'https://api.linkedin.com/v2',

  // OAuth scopes
  // See: https://learn.microsoft.com/en-us/linkedin/shared/authentication/permissions
  scopes: [
    'r_organization_social',     // Read organization posts
    'rw_organization_admin',     // Manage organization pages
  ],
};

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
  };
}
