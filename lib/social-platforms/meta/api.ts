/**
 * Meta (Facebook + Instagram) API client for fetching analytics
 */

import { metaPostMedia, META_POST_MEDIA_FIELDS, type MetaPostMedia } from './post-media';
import { collectPostInsights, prioritizePostInsights } from './post-insights';
import { META_CONFIG } from './config';
import { apiRequest, buildUrl } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';
import type { DemographicEntry } from '@/lib/demographics-queries';

const GRAPH_URL = META_CONFIG.graphUrl;
const INSTAGRAM_POST_INSIGHTS_LIMIT = Number(process.env.INSTAGRAM_POST_INSIGHTS_LIMIT ?? 500);
const FACEBOOK_POST_INSIGHTS_LIMIT = Number(process.env.FACEBOOK_POST_INSIGHTS_LIMIT ?? 500);
const INSTAGRAM_POST_INSIGHTS_CONCURRENCY = Number(process.env.INSTAGRAM_POST_INSIGHTS_CONCURRENCY ?? 6);

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

interface MetaMediaItem extends MetaPostMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
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

interface MetaPostItem extends MetaPostMedia {
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

    // Impressions: use page_impressions or page_posts_impressions
    const impressions = values.page_impressions ?? values.page_posts_impressions ?? values.impressions ?? 0;

    // Reach: use page_impressions_unique (unique users who saw content)
    const reach = values.reach ?? values.page_impressions_unique ?? 0;

    // Views: only from actual view metrics — never fallback to impressions
    const mediaViews = values.page_media_view ?? 0;
    const videoViews = values.page_video_views ?? 0;
    const directViews = values.views ?? values.content_views ?? 0;
    // Use video/media view metrics only — do not inflate with impressions
    const views = mediaViews > 0 ? mediaViews : (videoViews > 0 ? videoViews : directViews);

    // Engagement: use page_post_engagements (official engagement metric)
    const pageEngagements = values.page_post_engagements ?? 0;
    const igEngagements = (values.accounts_engaged ?? 0) + (values.total_interactions ?? 0);
    const manualEngagements = likes + comments + shares + saves;
    // Prefer page_post_engagements if available, otherwise sum manual counts
    const engagements = pageEngagements > 0 ? pageEngagements : (manualEngagements > 0 ? manualEngagements : igEngagements);

    return {
      date,
      ...baseMetric,
      impressions,
      reach,
      engagements,
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

  async sync({ externalAccountId, accessToken, postInsightsCheckedAt }) {
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

    // Fetch recent media with bounded pagination.
    const allMedia: MetaMediaItem[] = [];
    let nextMediaUrl: string | null = buildUrl(`${GRAPH_URL}/${externalAccountId}/media`, {
      fields: `id,caption,permalink,timestamp,like_count,comments_count,${META_POST_MEDIA_FIELDS.instagram}`,
      limit: 50,
      access_token: accessToken,
    });

    // Read up to 500 recent posts, including high-volume monthly campaigns.
    let mediaPages = 0;
    while (nextMediaUrl && mediaPages < 10) {
      const pageResponse: MetaMediaResponse = await apiRequest<MetaMediaResponse>(
        'instagram',
        nextMediaUrl,
        {},
        'media'
      );
      if (pageResponse.data?.length) {
        allMedia.push(...pageResponse.data);
      }
      nextMediaUrl = pageResponse.paging?.next || null;
      mediaPages++;
      const oldest = pageResponse.data?.at(-1)?.timestamp;
      if (oldest && Date.parse(oldest) < Date.now() - 90 * 86400000) break;
    }

    console.log(`[instagram] Fetched ${allMedia.length} media items`);

    let insightRequests = 0;
    const insightDeadline = Date.now() + 45_000;
    const canReadInsights = () => insightRequests < 180 && Date.now() < insightDeadline;
    const fetchMediaInsights = (mediaId: string, mediaType?: string) => collectPostInsights('instagram', async metrics => {
      if (!canReadInsights()) throw new Error('Post insight collection budget reached');
      insightRequests++;
      const url = buildUrl(`${GRAPH_URL}/${mediaId}/insights`, { metric: metrics.join(','), access_token: accessToken });
      return apiRequest('instagram', url, { timeout: 10000 }, `media_insights_${externalAccountId}`, true);
    }, mediaType === 'STORY');

    const posts: PostMetric[] = [];
    const mediaForInsights = prioritizePostInsights(allMedia, postInsightsCheckedAt).slice(0, Math.max(1, Math.min(INSTAGRAM_POST_INSIGHTS_LIMIT, allMedia.length)));
    console.log(`[instagram] Fetching post insights for ${mediaForInsights.length}/${allMedia.length} media`);
    const insightsByMedia = new Map<string, Record<string, number>>();

    for (let i = 0; i < mediaForInsights.length; i += Math.max(1, INSTAGRAM_POST_INSIGHTS_CONCURRENCY)) {
      if (!canReadInsights()) break;
      const chunk = mediaForInsights.slice(i, i + Math.max(1, INSTAGRAM_POST_INSIGHTS_CONCURRENCY));
      const chunkResults = await Promise.all(
        chunk.map(async (item) => ({
          id: item.id,
          insights: await fetchMediaInsights(
            item.id,
            (item.media_product_type ?? "").toUpperCase() === "REELS" ? "REEL" : item.media_type
          )
        }))
      );
      for (const result of chunkResults) {
        insightsByMedia.set(result.id, { ...result.insights, _visibility_checked_at: Date.now() });
      }
    }

    for (const item of allMedia) {
      const likes = item.like_count || 0;
      const comments = item.comments_count || 0;

      const insights = insightsByMedia.get(item.id);

      const baseEngagements = likes + comments;
      // The API total already includes saves and shares.
      const engagements = insights?.engagements ?? (baseEngagements + (insights?.saves ?? 0) + (insights?.shares ?? 0));

      const metrics: Record<string, number> = {
        likes,
        comments,
        engagements,
      };
      if (insights) Object.assign(metrics, insights);

      posts.push({
        external_post_id: item.id,
        posted_at: item.timestamp || new Date().toISOString(),
        url: item.permalink,
        caption: item.caption?.slice(0, 500),
        ...metaPostMedia('instagram', item),
        metrics,
        raw_json: item as unknown as Record<string, unknown>,
      });
    }

    const postsWithVisibility = posts.filter(p =>
      (p.metrics?.impressions ?? 0) > 0 || (p.metrics?.reach ?? 0) > 0 || (p.metrics?.views ?? 0) > 0
    );
    console.log(`[instagram] Post insights: ${posts.length} total, ${postsWithVisibility.length} with visibility data`);

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
        entry.followers = entry.followers ?? accountInfo.followers_count ?? 0;
        dailyMap.set(date, entry);
      }

      dailyMetrics.splice(0, dailyMetrics.length, ...dailyMap.values());
    }

    return { dailyMetrics, posts };
  },
};

/**
 * Facebook connector
 */
export const facebookConnector: Connector = {
  platform: 'facebook',

  async sync({ externalAccountId, accessToken, postInsightsCheckedAt }) {
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
    const insights: MetaInsight[] = [];
    let insightsError: string | null = null;

    // Try each metric individually to handle unavailable metrics gracefully
    const metricsToTry = META_CONFIG.facebookInsightMetrics;
    console.log(`[facebook] Fetching insights, trying metrics: ${metricsToTry.join(', ')}`);

    const successfulMetrics: string[] = [];
    const failedMetrics: string[] = [];

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
          `insights_${metric}`,
          true // silentErrors - don't log expected 400s when metrics unavailable
        );

        if (response.data?.length) {
          insights.push(...response.data);
          successfulMetrics.push(metric);
          // Log sample value for debugging
          const sampleValue = response.data[0]?.values?.[0]?.value;
          console.log(`[facebook] ✓ ${metric}: ${response.data.length} data points (sample: ${JSON.stringify(sampleValue)})`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        failedMetrics.push(metric);
        // Only warn, don't spam logs
        if (!errorMsg.includes('100')) {
          console.warn(`[facebook] ✗ ${metric}: ${errorMsg.slice(0, 100)}`);
        }
      }
    }

    console.log(`[facebook] Metrics summary: ${successfulMetrics.length} OK (${successfulMetrics.join(', ')}), ${failedMetrics.length} failed`);

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

    // Fetch recent posts with engagement metrics (with pagination)
    console.log(`[facebook] Fetching posts...`);
    const allFbPosts: MetaPostItem[] = [];
    const postsFieldsBase = `id,message,created_time,permalink_url,shares,reactions.summary(total_count),comments.summary(total_count),${META_POST_MEDIA_FIELDS.facebook}`;
    const buildPostsUrl = () => buildUrl(`${GRAPH_URL}/${externalAccountId}/posts`, {
      fields: postsFieldsBase,
      limit: 50,
      access_token: accessToken,
    });

    let nextPostsUrl: string | null = buildPostsUrl();

    // Read up to 500 recent posts, including high-volume monthly campaigns.
    let postPages = 0;
    while (nextPostsUrl && postPages < 10) {
      const fbPageResponse: MetaPostsResponse = await apiRequest<MetaPostsResponse>(
        'facebook',
        nextPostsUrl,
        {},
        'posts'
      );
      if (fbPageResponse.data?.length) {
        allFbPosts.push(...fbPageResponse.data);
      }
      nextPostsUrl = fbPageResponse.paging?.next || null;
      postPages++;
      const oldest = fbPageResponse.data?.at(-1)?.created_time;
      if (oldest && Date.parse(oldest) < Date.now() - 90 * 86400000) break;
    }

    console.log(`[facebook] Fetched ${allFbPosts.length} posts`);

    const postInsightsById = new Map<string, Record<string, number>>();
    let insightRequests = 0;
    const insightDeadline = Date.now() + 45_000;
    const canReadInsights = () => insightRequests < 180 && Date.now() < insightDeadline;
    const postsForInsights = prioritizePostInsights(allFbPosts, postInsightsCheckedAt).slice(0, Math.max(1, FACEBOOK_POST_INSIGHTS_LIMIT));
    for (let i = 0; i < postsForInsights.length; i += 6) {
      if (!canReadInsights()) break;
      await Promise.all(postsForInsights.slice(i, i + 6).map(async post => {
        const metrics = await collectPostInsights('facebook', async names => {
          if (!canReadInsights()) throw new Error('Post insight collection budget reached');
          insightRequests++;
          const url = buildUrl(`${GRAPH_URL}/${post.id}/insights`, {
            metric: names.join(','), period: 'lifetime', access_token: accessToken,
          });
          return apiRequest('facebook', url, { timeout: 10000 }, `post_insights_${externalAccountId}`, true);
        });
        postInsightsById.set(post.id, { ...metrics, _visibility_checked_at: Date.now() });
      }));
    }
    const measured = [...postInsightsById.values()].filter(row => row.views !== undefined || row.viewers !== undefined).length;
    console.log(`[facebook] Post visibility: ${measured}/${postsForInsights.length} measured`);

    const posts: PostMetric[] = allFbPosts.map((post: any) => {
      const reactions = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const shares = post.shares?.count ?? 0;
      const insights = postInsightsById.get(post.id) ?? {};

      return {
        external_post_id: post.id,
        posted_at: post.created_time || new Date().toISOString(),
        url: post.permalink_url,
        caption: post.message?.slice(0, 500),
        ...metaPostMedia('facebook', post),
        metrics: {
          likes: reactions,
          comments: comments,
          shares: shares,
          ...insights,
          engagements: reactions + comments + shares,
        },
        raw_json: post as unknown as Record<string, unknown>,
      };
    });

    // Enrich daily metrics with post-level data
    if (posts.length > 0) {
      const hasPageMetrics = dailyMetrics.some(m =>
        (m.impressions ?? 0) > 0 || (m.reach ?? 0) > 0 || (m.engagements ?? 0) > 0
      );

      const dailyMap = new Map<string, DailyMetric>();
      for (const metric of dailyMetrics) {
        dailyMap.set(metric.date, metric);
      }

      for (const post of posts) {
        if (!post.posted_at) continue;
        const date = post.posted_at.slice(0, 10);
        const entry = dailyMap.get(date) ?? { date, followers, impressions: 0, reach: 0, engagements: 0, posts_count: 0 };

        entry.posts_count = (entry.posts_count ?? 0) + 1;
        entry.followers = entry.followers ?? followers;

        // When page-level metrics are all zeros, aggregate from post insights
        if (!hasPageMetrics) {
          entry.impressions = (entry.impressions ?? 0) + (post.metrics?.impressions ?? 0);
          entry.reach = (entry.reach ?? 0) + (post.metrics?.reach ?? 0);
          entry.views = (entry.views ?? 0) + (post.metrics?.views ?? 0);
          entry.engagements = (entry.engagements ?? 0) + (post.metrics?.engagements ?? 0);
        }

        dailyMap.set(date, entry);
      }

      dailyMetrics.splice(0, dailyMetrics.length, ...dailyMap.values());

      if (!hasPageMetrics) {
        console.log(`[facebook] Page metrics all zeros, enriched daily metrics from ${posts.length} post insights`);
      }
    }

    console.log(`[facebook] Sync complete: ${dailyMetrics.length} daily metrics, ${posts.length} posts`);
    return { dailyMetrics, posts };
  },
};

/**
 * Fetch audience demographics from Instagram Graph API.
 * Uses follower_demographics insight (lifetime).
 */
export async function fetchMetaDemographics(
  accessToken: string,
  igAccountId: string
): Promise<DemographicEntry[]> {
  const entries: DemographicEntry[] = [];

  try {
    const url = buildUrl(`${GRAPH_URL}/${igAccountId}/insights`, {
      metric: 'follower_demographics',
      period: 'lifetime',
      metric_type: 'total_value',
      access_token: accessToken,
    });

    const response = await apiRequest<MetaInsightsResponse>(
      'instagram',
      url,
      {},
      'instagram_demographics'
    );

    for (const insight of response.data ?? []) {
      const totalValue = insight.total_value?.value;
      if (!totalValue || typeof totalValue !== 'object') continue;

      // Determine dimension from metric name
      let dimension: string;
      if (insight.name.includes('age') || insight.name === 'follower_demographics') {
        // The follower_demographics metric returns breakdowns with keys like city, country, age, gender
        // We need to check the breakdown structure
      }

      // Handle total_value format: { value: { "25-34": 150, "35-44": 100, ... } }
      const breakdown = totalValue as unknown as Record<string, number>;
      const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
      if (total === 0) continue;

      // Detect dimension from the key patterns
      for (const [key, count] of Object.entries(breakdown)) {
        if (typeof count !== 'number') continue;

        const pct = Math.round((count / total) * 1000) / 10;

        // Age ranges like "18-24", "25-34"
        if (/^\d{2}-\d{2}$/.test(key) || key === '65+' || key === '13-17') {
          dimension = 'age';
        }
        // Gender like "M", "F", "U"
        else if (['M', 'F', 'U'].includes(key)) {
          dimension = 'gender';
        }
        // 2-letter country codes
        else if (/^[A-Z]{2}$/.test(key)) {
          dimension = 'country';
        }
        // City names (contains comma or longer string)
        else {
          dimension = 'city';
        }

        entries.push({
          dimension,
          value: key,
          percentage: pct,
          count,
        });
      }
    }
  } catch (error) {
    console.warn('[meta] Failed to fetch demographics:', error instanceof Error ? error.message : error);
  }

  return entries;
}
