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

    // Impressions: use page_impressions or page_posts_impressions
    const impressions = values.page_impressions ?? values.page_posts_impressions ?? values.impressions ?? 0;

    // Reach: use page_impressions_unique (unique users who saw content)
    const reach = values.reach ?? values.page_impressions_unique ?? 0;

    // Views: use page_media_view (new metric) or page_video_views, fallback to impressions
    const mediaViews = values.page_media_view ?? 0;
    const videoViews = values.page_video_views ?? 0;
    const pageViews = values.page_views_total ?? 0;
    const directViews = values.views ?? values.content_views ?? mediaViews ?? videoViews ?? 0;
    // For Facebook, use media_view as primary, then video_views, then impressions
    const views = mediaViews > 0 ? mediaViews : (videoViews > 0 ? videoViews : (directViews > 0 ? directViews : impressions));

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

    // Fetch recent media with pagination (up to 100 posts)
    const allMedia: MetaMediaItem[] = [];
    let nextMediaUrl: string | null = buildUrl(`${GRAPH_URL}/${externalAccountId}/media`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: 50,
      access_token: accessToken,
    });

    // Paginate to get more posts (max 2 pages = 100 posts)
    let mediaPages = 0;
    while (nextMediaUrl && mediaPages < 2) {
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
    }

    console.log(`[instagram] Fetched ${allMedia.length} media items`);

    // Fetch all insights for a media item in a single API call.
    // IMPORTANT: Meta deprecated `impressions` and `video_views` starting v22.0+.
    // Even on v21.0, the API now rejects these metrics for most media types.
    // Instagram also treats all VIDEO as REEL internally.
    // Safe metrics (as of Feb 2026):
    //   IMAGE/CAROUSEL_ALBUM: reach, saved
    //   VIDEO/REEL:           reach, plays, saved, shares, total_interactions
    //   STORY:                reach
    // NO FALLBACK: individual retries per media item caused 300s timeouts on Vercel.
    const fetchMediaInsights = async (mediaId: string, mediaType?: string) => {
      const normalized = (mediaType ?? "").toUpperCase();

      const result = { impressions: 0, reach: 0, views: 0, engagements: 0 };

      // Build STRICT metric list — NO impressions, NO video_views (both deprecated)
      let metricsToFetch: string;
      if (normalized === "REEL" || normalized === "VIDEO") {
        // Instagram treats all videos as reels now
        metricsToFetch = "reach,plays,saved,shares,total_interactions";
      } else if (normalized === "STORY") {
        metricsToFetch = "reach";
      } else {
        // IMAGE, CAROUSEL_ALBUM, or unknown
        metricsToFetch = "reach,saved";
      }

      try {
        const insightsUrl = buildUrl(`${GRAPH_URL}/${mediaId}/insights`, {
          metric: metricsToFetch,
          access_token: accessToken,
        });
        const response = await apiRequest<{ data?: Array<{ name?: string; values?: Array<{ value?: number }> }> }>(
          "instagram",
          insightsUrl,
          {},
          "media_insights",
          true
        );

        for (const metric of response.data ?? []) {
          const value = metric?.values?.[0]?.value;
          if (typeof value !== "number") continue;
          switch (metric.name) {
            case "reach":
              result.reach = value;
              // Use reach as impressions substitute since impressions is deprecated
              result.impressions = value;
              break;
            case "plays":
              result.views = Math.max(result.views, value);
              break;
            case "total_interactions":
              result.engagements = Math.max(result.engagements, value);
              break;
            case "saved":
              result.engagements += value;
              break;
          }
        }
      } catch (err) {
        // Log failure but do NOT retry individually — too slow for 100+ items
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[instagram] Media insights failed for ${mediaId} (${normalized}): ${msg.slice(0, 150)}`);
      }

      return result;
    };

    const posts: PostMetric[] = [];
    for (const item of allMedia) {
      const likes = item.like_count || 0;
      const comments = item.comments_count || 0;

      // Single API call per post to get all insights
      const insights = await fetchMediaInsights(item.id, item.media_type);

      const baseEngagements = likes + comments;
      // Use API engagements if our base count is 0 (some posts hide like_count)
      const engagements = baseEngagements > 0 ? baseEngagements : Math.max(baseEngagements, insights.engagements);

      posts.push({
        external_post_id: item.id,
        posted_at: item.timestamp || new Date().toISOString(),
        url: item.permalink,
        caption: item.caption?.slice(0, 500),
        media_type: item.media_type?.toLowerCase(),
        thumbnail_url: item.thumbnail_url || item.media_url,
        media_url: item.media_url,
        metrics: {
          likes,
          comments,
          engagements,
          impressions: insights.impressions,
          reach: insights.reach,
          views: insights.views,
        },
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
    const postsFieldsBase = 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count),comments.summary(total_count)';
    const buildPostsUrl = () => buildUrl(`${GRAPH_URL}/${externalAccountId}/posts`, {
      fields: postsFieldsBase,
      limit: 50,
      access_token: accessToken,
    });

    let nextPostsUrl: string | null = buildPostsUrl();

    // Paginate to get more posts (max 2 pages = 100 posts)
    let postPages = 0;
    while (nextPostsUrl && postPages < 2) {
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
    }

    console.log(`[facebook] Fetched ${allFbPosts.length} posts`);

    // Try to fetch post-level insights via batch API.
    // Some pages/posts no longer expose post_impressions*; probe alternatives.
    const fetchPostInsights = async (postIds: string[]) => {
      const result = new Map<string, { impressions: number; reach: number; views: number }>();
      if (!postIds.length) return result;

      const parseInsightValue = (value: unknown): number => {
        if (typeof value === "number") return value;
        if (value && typeof value === "object") {
          return Object.values(value as Record<string, unknown>).reduce((sum: number, entry) => {
            return sum + (typeof entry === "number" ? entry : 0);
          }, 0);
        }
        return 0;
      };

      type MetricSpec = {
        metric: string;
        target: "impressions" | "reach" | "views";
      };
      const metricSpecs: MetricSpec[] = [
        { metric: "post_impressions", target: "impressions" },
        { metric: "post_impressions_unique", target: "reach" },
        { metric: "post_media_view", target: "views" },
        { metric: "post_total_media_view_unique", target: "reach" },
      ];
      const versions = [META_CONFIG.apiVersion, "v25.0", "v24.0", "v23.0", "v21.0"]
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index);

      // Probe: use single-metric endpoint per Meta docs
      const testPostId = postIds[0];
      const supported: Array<MetricSpec & { version: string }> = [];
      for (const spec of metricSpecs) {
        let accepted = false;
        for (const version of versions) {
          try {
            const versionUrl = `https://graph.facebook.com/${version}`;
            const testUrl = buildUrl(`${versionUrl}/${testPostId}/insights/${spec.metric}`, {
              period: "lifetime",
              access_token: accessToken,
            });
            await apiRequest<{ data?: unknown[] }>(
              "facebook", testUrl, {}, "post_insights_probe", true
            );
            supported.push({ ...spec, version });
            accepted = true;
            break;
          } catch (probeErr) {
            const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
            if (msg.includes("valid insights metric")) {
              continue;
            }
            if (msg.includes("Permissions error")) {
              console.warn(`[facebook] Post insights probe failed (permissions) for ${spec.metric}: ${msg.slice(0, 120)}`);
              return result;
            }
            console.warn(`[facebook] Post insights probe failed for ${spec.metric}: ${msg.slice(0, 120)}`);
          }
        }
        if (!accepted) {
          console.warn(`[facebook] Post insights metric unavailable: ${spec.metric}`);
        }
      }

      if (!supported.length) {
        console.warn("[facebook] No valid post insights metrics available for this page.");
        return result;
      }

      // Batch endpoints are inconsistent for post insights on some pages.
      // Use direct metric calls with bounded concurrency for reliability.
      const POST_CONCURRENCY = 8;
      for (let i = 0; i < postIds.length; i += POST_CONCURRENCY) {
        const chunk = postIds.slice(i, i + POST_CONCURRENCY);
        await Promise.all(
          chunk.map(async (postId) => {
            const existing = result.get(postId) ?? { impressions: 0, reach: 0, views: 0 };
            for (const spec of supported) {
              try {
                const versionUrl = `https://graph.facebook.com/${spec.version}`;
                const metricUrl = buildUrl(`${versionUrl}/${postId}/insights/${spec.metric}`, {
                  period: "lifetime",
                  access_token: accessToken,
                });
                const response = await apiRequest<{ data?: Array<{ values?: Array<{ value?: unknown }> }> }>(
                  "facebook",
                  metricUrl,
                  {},
                  `post_insights_${spec.metric}`,
                  true
                );
                const value = response?.data?.[0]?.values?.[0]?.value;
                const parsedValue = parseInsightValue(value);
                if (spec.target === "impressions") {
                  if (existing.impressions === 0 && parsedValue > 0) {
                    existing.impressions = parsedValue;
                  }
                } else if (spec.target === "reach") {
                  if (existing.reach === 0 && parsedValue > 0) {
                    existing.reach = parsedValue;
                  }
                } else {
                  if (existing.views === 0 && parsedValue > 0) {
                    existing.views = parsedValue;
                  }
                }
              } catch {
                // Keep best effort behavior: one metric failure should not discard the post.
              }
            }
            result.set(postId, existing);
          })
        );
      }

      return result;
    };

    const postInsightsById = await fetchPostInsights(allFbPosts.map((post: any) => post.id));
    const postsWithInsights = Array.from(postInsightsById.values()).filter(v => v.reach > 0 || v.impressions > 0);
    console.log(`[facebook] Post insights: ${postInsightsById.size} fetched, ${postsWithInsights.length} with reach/impressions data`);

    const posts: PostMetric[] = allFbPosts.map((post: any) => {
      const reactions = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const shares = post.shares?.count ?? 0;
      const insights = postInsightsById.get(post.id) ?? { impressions: 0, reach: 0, views: 0 };

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
          impressions: insights.impressions,
          reach: insights.reach,
          views: insights.views,
          media_views: insights.impressions,
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
