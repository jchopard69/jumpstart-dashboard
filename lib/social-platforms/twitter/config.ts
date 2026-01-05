/**
 * X/Twitter API v2 configuration
 */

export const TWITTER_CONFIG = {
  authUrl: 'https://twitter.com/i/oauth2/authorize',
  tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  apiUrl: 'https://api.twitter.com/2',

  // OAuth 2.0 PKCE scopes
  // See: https://developer.twitter.com/en/docs/authentication/oauth-2-0/user-access-token
  scopes: [
    'tweet.read',        // Read tweets
    'users.read',        // Read user profile
    'offline.access',    // Get refresh token
  ],
};

export function getTwitterConfig() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = process.env.TWITTER_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/twitter/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth not configured: TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are required');
  }

  return {
    ...TWITTER_CONFIG,
    clientId,
    clientSecret,
    redirectUri,
  };
}
