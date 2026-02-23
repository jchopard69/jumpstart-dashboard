/**
 * Meta (Facebook + Instagram) OAuth configuration
 */

export const META_CONFIG = {
  apiVersion: process.env.META_API_VERSION || 'v25.0',
  graphUrl: `https://graph.facebook.com/${process.env.META_API_VERSION || 'v25.0'}`,
  authUrl: `https://www.facebook.com/${process.env.META_API_VERSION || 'v25.0'}/dialog/oauth`,
  tokenUrl: `https://graph.facebook.com/${process.env.META_API_VERSION || 'v25.0'}/oauth/access_token`,

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
  // Based on official Meta API documentation (2025)
  // These are fetched individually to handle unavailable metrics gracefully
  facebookInsightMetrics: [
    // Impressions & Reach (period: day)
    'page_impressions',            // Total impressions (content displayed)
    'page_impressions_unique',     // Reach (unique users who saw content)

    // Media Views - NEW metric replacing impressions (period: day)
    'page_media_view',             // Number of times content was played/displayed

    // Engagement (period: day)
    'page_post_engagements',       // Total interactions (reactions, comments, shares)

    // Video Views (period: day)
    'page_video_views',            // 3s+ video views

    // Page Views (period: day)
    'page_views_total',            // Page profile views

    // Posts impressions (period: day)
    'page_posts_impressions',      // Times posts appeared on screen
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
