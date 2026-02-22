/**
 * Meta (Facebook + Instagram) OAuth configuration
 */

export const META_CONFIG = {
  apiVersion: 'v21.0',
  graphUrl: 'https://graph.facebook.com/v21.0',
  authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',

  // Required scopes for full functionality
  // See: https://developers.facebook.com/docs/permissions/reference
  scopes: [
    // Pages
    'pages_show_list',           // CRITICAL: Required to list user's pages
    'pages_read_engagement',     // Read page engagement data
    'pages_read_user_content',   // Read user-generated content on pages
    'pages_manage_metadata',     // Read page metadata
    'read_insights',             // CRITICAL: Required for page insights (impressions, reach, etc.)

    // Instagram
    'instagram_basic',           // Basic Instagram account info
    'instagram_manage_insights', // Instagram insights/analytics

    // Business (required for some Business Manager setups)
    'business_management',       // Access to Business Manager assets
  ],

  // Fields to request when fetching pages
  pageFields: [
    'id',
    'name',
    'access_token',
    'category',
    'picture',
    'fan_count',
    'followers_count',
    'instagram_business_account{id,username,profile_picture_url,followers_count}',
  ].join(','),

  // Instagram insights: time-series metrics
  instagramTimeSeriesMetrics: [
    'reach',
  ],
  // Instagram insights: total_value metrics (require metric_type=total_value)
  instagramTotalValueMetrics: [
    'profile_views',
    'website_clicks',
    'accounts_engaged',
    'total_interactions',
    'likes',
    'comments',
    'shares',
    'saves',
    'replies',
    'views',
    'content_views',
  ],

  // Fields for Facebook page insights
  // See: https://developers.facebook.com/docs/graph-api/reference/page/insights
  // These are fetched individually to handle unavailable metrics gracefully
  // Note: Available metrics vary by page type and activity level
  facebookInsightMetrics: [
    'page_impressions_unique',     // Reach (unique users) - most reliable
    'page_impressions_organic',    // Organic impressions
    'page_impressions_viral',      // Viral impressions
    'page_consumptions',           // Total clicks on page content
    'page_engaged_users',          // Engaged users
    'page_actions_post_reactions_total', // Total reactions
  ],
};

export function getMetaConfig() {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/meta/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Meta OAuth not configured: META_APP_ID and META_APP_SECRET are required');
  }

  return {
    ...META_CONFIG,
    clientId,
    clientSecret,
    redirectUri,
  };
}
