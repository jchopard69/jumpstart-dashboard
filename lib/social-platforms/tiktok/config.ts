/**
 * TikTok Business API configuration
 */

export const TIKTOK_CONFIG = {
  authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
  apiUrl: 'https://open.tiktokapis.com/v2',

  // Scopes for TikTok Business API
  // See: https://developers.tiktok.com/doc/tiktok-api-scopes
  scopes: [
    'user.info.basic',      // Basic user info
    'user.info.profile',    // Profile info (username, avatar)
    'user.info.stats',      // User statistics
    'video.list',           // List user's videos
  ],
};

export function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/tiktok/callback`;

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok OAuth not configured: TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET are required');
  }

  return {
    ...TIKTOK_CONFIG,
    clientKey,
    clientSecret,
    redirectUri,
  };
}
