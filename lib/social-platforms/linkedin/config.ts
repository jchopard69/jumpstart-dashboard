/**
 * LinkedIn Marketing API configuration
 */

export const LINKEDIN_CONFIG = {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  apiUrl: 'https://api.linkedin.com/rest',

  // OAuth scopes (DMA-only)
  // See: https://learn.microsoft.com/en-us/linkedin/dma/pages-data-portability-overview
  scopes: [
    'r_dma_admin_pages_content',  // DMA: Pages content + reporting data
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
