/**
 * YouTube Data API v3 configuration
 */

export const YOUTUBE_CONFIG = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  apiUrl: 'https://www.googleapis.com/youtube/v3',
  analyticsApiUrl: 'https://youtubeanalytics.googleapis.com/v2',

  // OAuth scopes
  // See: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
  scopes: [
    'https://www.googleapis.com/auth/youtube.readonly',        // Read channel & video data
    'https://www.googleapis.com/auth/yt-analytics.readonly',   // YouTube Analytics
  ],
};

export function getYouTubeConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/youtube/callback`;

  // Fall back to API key mode if no OAuth credentials
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!clientId || !clientSecret) {
    if (apiKey) {
      console.warn('[youtube] OAuth not configured, falling back to API key mode');
      return {
        ...YOUTUBE_CONFIG,
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        apiKey,
        mode: 'api_key' as const,
      };
    }
    throw new Error('YouTube not configured: Either GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or YOUTUBE_API_KEY is required');
  }

  return {
    ...YOUTUBE_CONFIG,
    clientId,
    clientSecret,
    redirectUri,
    apiKey,
    mode: 'oauth' as const,
  };
}
