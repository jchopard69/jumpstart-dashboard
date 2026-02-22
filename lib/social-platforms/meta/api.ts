/**
 * Meta (Facebook + Instagram) API client for fetching analytics
 */

import { META_CONFIG } from './config';
import { apiRequest, buildUrl } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const GRAPH_URL = META_CONFIG.graphUrl;

interface MetaInsightValue {
  value: number | { [key: string]: number };
  end_time?: string;
}

interface MetaInsight {
  name: string;
  period: string;
  values: MetaInsightValue[];
  total_value?: { value: number };
}

interface MetaInsightsResponse {
  data: MetaInsight[];
  paging?: { next?: string };
}

interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface MetaMediaResponse {
  data: MetaMediaItem[];
  paging?: { next?: string };
}

interface MetaAccountInfo {
  followers_count?: number;
  media_count?: number;
  fan_count?: number;
}

interface MetaPostItem {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
}

interface MetaPostsResponse {
  data: MetaPostItem[];
  paging?: { next?: string };
}

/**
 * Map Meta insights to daily metrics format
 * Distributes total_value metrics proportionally based on daily reach
 */
function mapInsightsToDaily(
  insights: MetaInsight[],
  baseMetric: Partial<DailyMetric> = {},
  fallbackDate?: string
): DailyMetric[] {
  const dailyMap: Record<string, Record<string, number>> = {};
  const totalValueMetrics: Record<string, number> = {};

  // First pass: collect time-series data and total_value metrics separately
  for (const metric of insights) {
    const metricName = metric.name;

    // Store total_value metrics for later distribution
    if (!metric.values?.length && metric.total_value) {
      totalValueMetrics[metricName] = metric.total_value.value ?? 0;
      continue;
    }

    // Process time-series values
    for (const value of metric.values || []) {
      const date = value.end_time?.slice(0, 10) ?? fallbackDate;
      if (!date) continue;

      if (!dailyMap[date]) {
        dailyMap[date] = {};
      }

      // Handle both simple numbers and nested objects
      const numValue = typeof value.value === 'number'
        ? value.value
        : (typeof value.value === 'object' && value.value !== null)
          ? Object.values(value.value).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
          : 0;

      dailyMap[date][metricName] = numValue;
    }
  }

  // Calculate total reach for proportional distribution
  const totalReach = Object.values(dailyMap).reduce((sum, day) => sum + (day.reach ?? 0), 0);

  // Distribute total_value metrics proportionally based on reach
  if (totalReach > 0 && Object.keys(totalValueMetrics).length > 0) {
    for (const [date, values] of Object.entries(dailyMap)) {
      const dayReach = values.reach ?? 0;
      const proportion = dayReach / totalReach;

      for (const [metricName, totalValue] of Object.entries(totalValueMetrics)) {
        // Distribute proportionally, rounding to avoid decimals
        values[metricName] = Math.round(totalValue * proportion);
      }
    }
  } else if (Object.keys(totalValueMetrics).length > 0 && fallbackDate) {
    // Fallback: assign all totals to fallbackDate if no reach data
    if (!dailyMap[fallbackDate]) {
      dailyMap[fallbackDate] = {};
    }
    for (const [metricName, totalValue] of Object.entries(totalValueMetrics)) {
      dailyMap[fallbackDate][metricName] = totalValue;
    }
  }

  return Object.entries(dailyMap).map(([date, values]) => {
    const likes = values.likes ?? 0;
    const comments = values.comments ?? 0;
    const shares = values.shares ?? 0;
    const saves = values.saves ?? 0;

    // Impressions: combine organic + viral, or use direct value
    const organicImpressions = values.page_impressions_organic ?? 0;
    const viralImpressions = values.page_impressions_viral ?? 0;
    const combinedImpressions = organicImpressions + viralImpressions;
    const impressions = combinedImpressions > 0 ? combinedImpressions : (values.page_impressions ?? values.impressions ?? 0);

    // Reach
    const reach = values.reach ?? values.page_impressions_unique ?? 0;

    // Views: use impressions as fallback if no direct views
    const directViews = values.views ?? values.content_views ?? values.video_views ?? values.page_video_views ?? values.page_views_total ?? 0;
    const views = directViews > 0 ? directViews : impressions;

    // Engagement: combine all engagement metrics
    const pageConsumptions = values.page_consumptions ?? 0;
    const pageReactions = values.page_actions_post_reactions_total ?? 0;
    const engagementFallback =
      pageConsumptions + pageReactions +
      (values.page_post_engagements ?? 0) +
      (values.accounts_engaged ?? 0) +
      (values.total_interactions ?? 0) +
      (values.page_engaged_users ?? 0);
    const engagements = likes + comments + shares + saves;

    return {
      date,
      ...baseMetric,
      impressions,
      reach,
      engagements: engagements > 0 ? engagements : engagementFallback,
      likes,
      comments,
      shares,
      saves,
      replies: values.replies ?? 0,
      views,
      raw_json: values,
    };
  });
}

/**
 * Instagram connector
 */
export const instagramConnector: Connector = {
  platform: 'instagram',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing Meta access token for Instagram');
    }

    // Insights range (Meta IG API supports 30-day windows)
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    const since = Math.floor(start.getTime() / 1000);
    const until = Math.floor(end.getTime() / 1000);

    // Fetch account info
    const accountInfoUrl = buildUrl(`${GRAPH_URL}/${externalAccountId}`, {
      fields: 'followers_count,media_count,username',
      access_token: accessToken,
    });

    const accountInfo = await apiRequest<MetaAccountInfo>(
      'instagram',
      accountInfoUrl,
      {},
      'account_info'
    );

    const fetchInsights = async (
      metrics: string[],
      label: string,
      metricType?: "total_value"
    ) => {
      let nextUrl: string | undefined = buildUrl(`${GRAPH_URL}/${externalAccountId}/insights`, {
        metric: metrics.join(','),
        period: 'day',
        metric_type: metricType,
        since: since,
        until: until,
        access_token: accessToken,
      });
      const collected: MetaInsight[] = [];

      while (nextUrl) {
        const insightsResponse: MetaInsightsResponse = await apiRequest<MetaInsightsResponse>(
          'instagram',
          nextUrl,
          {},
          label
        );
        if (insightsResponse.data?.length) {
          collected.push(...insightsResponse.data);
        }
        nextUrl = insightsResponse.paging?.next;
      }

      return collected;
    };

    let insights: MetaInsight[] = [];
    try {
      const timeSeries = META_CONFIG.instagramTimeSeriesMetrics.length
        ? await fetchInsights(META_CONFIG.instagramTimeSeriesMetrics, 'insights_time_series')
        : [];
      const totals = META_CONFIG.instagramTotalValueMetrics.length
        ? await fetchInsights(META_CONFIG.instagramTotalValueMetrics, 'insights_total', 'total_value')
        : [];
      insights = [...timeSeries, ...totals];
    } catch (error) {
      console.warn('[instagram] Failed to fetch insights:', error);
    }

    // Build daily metrics
    const fallbackDate = new Date().toISOString().slice(0, 10);
    const dailyMetrics = mapInsightsToDaily(insights, {
      followers: accountInfo.followers_count ?? 0,
      posts_count: 0, // Will be calculated from posts, not total account media count
    }, fallbackDate);

    // If no insights data, create a single metric for today
    if (dailyMetrics.length === 0) {
      dailyMetrics.push({
        date: new Date().toISOString().slice(0, 10),
        followers: accountInfo.followers_count ?? 0,
        posts_count: accountInfo.media_count ?? 0,
        impressions: 0,
        reach: 0,
        engagements: 0,
      });
    }

    // Fetch recent media
    const mediaUrl = buildUrl(`${GRAPH_URL}/${externalAccountId}/media`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: 50,
      access_token: accessToken,
    });

    const mediaResponse = await apiRequest<MetaMediaResponse>(
      'instagram',
      mediaUrl,
      {},
      'media'
    );

    const fetchMediaViews = async (mediaId: string, mediaType?: string) => {
      const normalized = (mediaType ?? "").toUpperCase();
      const metrics =
        normalized === "REEL"
          ? ["plays", "views", "video_views"]
          : normalized === "VIDEO"
            ? ["video_views", "views"]
            : [];
      if (!metrics.length) return 0;

      for (const metric of metrics) {
        try {
          const insightsUrl = buildUrl(`${GRAPH_URL}/${mediaId}/insights`, {
            metric,
            access_token: accessToken,
          });
          const response = await apiRequest<{ data?: Array<{ values?: Array<{ value?: number }> }> }>(
            "instagram",
            insightsUrl,
            {},
            "media_views",
            true  // silentErrors - don't log expected 400s when trying different metrics
          );
          const value = response.data?.[0]?.values?.[0]?.value;
          if (typeof value === "number") {
            return value;
          }
        } catch {
          continue;
        }
      }

      return 0;
    };

    const posts: PostMetric[] = [];
    for (const item of mediaResponse.data || []) {
      posts.push({
        external_post_id: item.id,
        posted_at: item.timestamp || new Date().toISOString(),
        url: item.permalink,
        caption: item.caption?.slice(0, 500),
        media_type: item.media_type?.toLowerCase(),
        thumbnail_url: item.thumbnail_url || item.media_url,
        media_url: item.media_url,
        metrics: {
          likes: item.like_count || 0,
          comments: item.comments_count || 0,
          views: await fetchMediaViews(item.id, item.media_type),
        },
        raw_json: item as unknown as Record<string, unknown>,
      });
    }

    if (posts.length) {
      const dailyMap = new Map<string, DailyMetric>();
      for (const metric of dailyMetrics) {
        dailyMap.set(metric.date, metric);
      }

      for (const post of posts) {
        if (!post.posted_at) continue;
        const date = post.posted_at.slice(0, 10);
        const entry = dailyMap.get(date) ?? { date };
        entry.posts_count = (entry.posts_count ?? 0) + 1;
        entry.engagements =
          (entry.engagements ?? 0) +
          ((post.metrics?.likes ?? 0) + (post.metrics?.comments ?? 0));
        const views = post.metrics?.views ?? 0;
        entry.views = (entry.views ?? 0) + views;
        entry.followers = entry.followers ?? accountInfo.followers_count ?? 0;
        dailyMap.set(date, entry);
      }

      dailyMetrics.splice(0, dailyMetrics.length, ...dailyMap.values());
    }

    for (const metric of dailyMetrics) {
      if ((metric.impressions ?? 0) === 0 && (metric.reach ?? 0) > 0) {
        metric.impressions = metric.reach ?? 0;
      }
      if ((metric.views ?? 0) === 0) {
        metric.views = metric.impressions ?? metric.reach ?? 0;
      }
    }

    return { dailyMetrics, posts };
  },
};

/**
 * Facebook connector
 */
export const facebookConnector: Connector = {
  platform: 'facebook',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing Meta access token for Facebook');
    }

    console.log(`[facebook] Starting sync for page ${externalAccountId}`);

    // Calculate date range (last 90 days for better API reliability)
    const since = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);

    // Fetch page info
    const pageInfoUrl = buildUrl(`${GRAPH_URL}/${externalAccountId}`, {
      fields: 'followers_count,fan_count,name',
      access_token: accessToken,
    });

    console.log(`[facebook] Fetching page info...`);
    const pageInfo = await apiRequest<MetaAccountInfo>(
      'facebook',
      pageInfoUrl,
      {},
      'page_info'
    );
    console.log(`[facebook] Page info: followers=${pageInfo.followers_count ?? pageInfo.fan_count ?? 0}`);

    // Fetch page insights with pagination
    let insights: MetaInsight[] = [];
    let insightsError: string | null = null;

    // Try each metric individually to handle unavailable metrics gracefully
    const metricsToTry = META_CONFIG.facebookInsightMetrics;
    console.log(`[facebook] Fetching insights, trying metrics: ${metricsToTry.join(', ')}`);

    for (const metric of metricsToTry) {
      try {
        const metricUrl = buildUrl(`${GRAPH_URL}/${externalAccountId}/insights`, {
          metric: metric,
          period: 'day',
          since: since,
          until: until,
          access_token: accessToken,
        });

        const response: MetaInsightsResponse = await apiRequest<MetaInsightsResponse>(
          'facebook',
          metricUrl,
          {},
          `insights_${metric}`
        );

        if (response.data?.length) {
          insights.push(...response.data);
          console.log(`[facebook] Got ${response.data.length} data points for ${metric}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[facebook] Metric ${metric} not available: ${errorMsg}`);
        // Continue with other metrics
      }
    }

    if (insights.length > 0) {
      console.log(`[facebook] Successfully fetched ${insights.length} insight data points`);
    } else {
      insightsError = 'No insights metrics available for this page';
      console.warn(`[facebook] No insights data available for page ${externalAccountId}`);
    }

    // Build daily metrics
    const followers = pageInfo.followers_count ?? pageInfo.fan_count ?? 0;
    const dailyMetrics = mapInsightsToDaily(insights, { followers });

    // If no insights data, create a single metric for today with error flag
    if (dailyMetrics.length === 0) {
      console.warn(`[facebook] No insights data available. Creating placeholder metric.`);
      if (insightsError) {
        console.warn(`[facebook] Insights error was: ${insightsError}`);
      }
      dailyMetrics.push({
        date: new Date().toISOString().slice(0, 10),
        followers,
        impressions: 0,
        reach: 0,
        engagements: 0,
        raw_json: insightsError ? { _error: insightsError } : undefined,
      });
    }

    // Fetch recent posts with engagement metrics
    console.log(`[facebook] Fetching posts...`);
    const postsUrl = buildUrl(`${GRAPH_URL}/${externalAccountId}/posts`, {
      fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count),comments.summary(total_count)',
      limit: 50,
      access_token: accessToken,
    });

    const postsResponse = await apiRequest<MetaPostsResponse>(
      'facebook',
      postsUrl,
      {},
      'posts'
    );

    console.log(`[facebook] Fetched ${postsResponse.data?.length ?? 0} posts`);

    const posts: PostMetric[] = (postsResponse.data || []).map((post: any) => {
      const reactions = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const shares = post.shares?.count ?? 0;

      return {
        external_post_id: post.id,
        posted_at: post.created_time || new Date().toISOString(),
        url: post.permalink_url,
        caption: post.message?.slice(0, 500),
        media_type: post.full_picture ? 'image' : 'text',
        thumbnail_url: post.full_picture,
        media_url: post.full_picture,
        metrics: {
          likes: reactions,
          comments: comments,
          shares: shares,
          engagements: reactions + comments + shares,
        },
        raw_json: post as unknown as Record<string, unknown>,
      };
    });

    // If page insights failed but we have posts, aggregate post metrics into daily
    if (insights.length === 0 && posts.length > 0) {
      console.log(`[facebook] No page insights, aggregating from ${posts.length} posts`);
      const dailyMap = new Map<string, DailyMetric>();

      for (const post of posts) {
        if (!post.posted_at) continue;
        const date = post.posted_at.slice(0, 10);
        const existing = dailyMap.get(date) ?? {
          date,
          followers,
          impressions: 0,
          reach: 0,
          engagements: 0,
          posts_count: 0,
        };

        existing.posts_count = (existing.posts_count ?? 0) + 1;
        existing.engagements = (existing.engagements ?? 0) +
          (post.metrics?.likes ?? 0) +
          (post.metrics?.comments ?? 0) +
          (post.metrics?.shares ?? 0);

        dailyMap.set(date, existing);
      }

      // Replace placeholder with aggregated data
      if (dailyMap.size > 0) {
        dailyMetrics.splice(0, dailyMetrics.length, ...dailyMap.values());
        console.log(`[facebook] Created ${dailyMetrics.length} daily metrics from posts`);
      }
    }

    console.log(`[facebook] Sync complete: ${dailyMetrics.length} daily metrics, ${posts.length} posts`);
    return { dailyMetrics, posts };
  },
};
