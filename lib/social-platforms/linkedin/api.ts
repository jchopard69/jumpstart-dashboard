/**
 * LinkedIn Pages Data Portability API (DMA) connector for analytics
 *
 * Uses the DMA endpoints (r_dma_admin_pages_content scope) instead of
 * Community Management API which requires separate approval.
 *
 * Endpoints used:
 * - /dmaOrganizationalPageEdgeAnalytics (follower/visitor trends)
 * - /dmaOrganizationalPageContentAnalytics (post-level & page-level content analytics)
 * - /dmaPosts (fetch post details)
 * - /dmaFeedContentsExternal (list posts by author)
 * - /dmaSocialMetadata (reaction/comment counts per post)
 */

import { LINKEDIN_CONFIG, getLinkedInVersion } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_REST_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();

const MAX_POSTS_SYNC = 50;

// ── Types ──────────────────────────────────────────────────────────────

type EdgeAnalyticsElement = {
  type: string; // FOLLOWER | VISITOR
  value: {
    totalCount?: { long?: number; bigDecimal?: string };
    typeSpecificValue?: {
      followerEdgeAnalyticsValue?: { organicValue?: number; sponsoredValue?: number };
      visitorEdgeAnalyticsValue?: {
        desktopCount?: number;
        mobileCount?: number;
        uniqueCount?: number;
      };
    };
  };
  timeIntervals?: {
    timeRange?: { start?: number; end?: number };
  };
};

type ContentAnalyticsElement = {
  type: string; // IMPRESSIONS | UNIQUE_IMPRESSIONS | CLICKS | COMMENTS | REACTIONS | REPOSTS
  metric?: {
    timeIntervals?: { timeRange?: { start?: number; end?: number } };
    value?: {
      totalCount?: { long?: number; bigDecimal?: string };
      typeSpecificValue?: {
        contentAnalyticsValue?: { organicValue?: { long?: number }; sponsoredValue?: { long?: number } };
      };
    };
  };
  sourceEntity?: string;
};

type SocialMetadataResponse = {
  reactionSummary?: { totalCount?: number };
  commentSummary?: { totalCount?: number };
  shareCount?: number;
};

type DmaPostElement = {
  id?: string;
  author?: string;
  commentary?: string;
  content?: Record<string, unknown>;
  created?: { actor?: string; time?: number };
  lastModified?: { actor?: string; time?: number };
  publishedAt?: number;
  lifecycleState?: string;
  visibility?: string;
  distribution?: Record<string, unknown>;
  // Legacy fields kept for compat
  createdAt?: number;
};

type FeedContentsElement = {
  id?: string;
  // Legacy field name
  contentUrn?: string;
  type?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Determine the media_type from a DMA post's content field.
 * Maps LinkedIn content types to normalized format names used by insights.
 */
export function detectLinkedInMediaType(content?: Record<string, unknown>): string {
  if (!content) return 'text';
  if (content.carousel) return 'carousel';
  if (content.multiImage) return 'carousel';
  if (content.poll) return 'text';
  if (content.article) return 'link';
  if (content.celebration) return 'image';
  if (content.media) {
    const media = content.media as Record<string, unknown>;
    if (media.video) return 'video';
    if (media.document) return 'link';
    // image by default for media content
    return 'image';
  }
  return 'text';
}

export function buildHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0'
  };
  if (API_VERSION) {
    headers['LinkedIn-Version'] = API_VERSION;
  }
  return headers;
}

export function normalizeOrganizationId(value: string): string {
  return value
    .replace('urn:li:organization:', '')
    .replace('urn:li:organizationalPage:', '');
}

function getMetricTotalCount(element: ContentAnalyticsElement): number {
  const totalCount = element.metric?.value?.totalCount;
  if (totalCount?.long !== undefined) return totalCount.long;
  if (totalCount?.bigDecimal !== undefined) return parseFloat(totalCount.bigDecimal);
  // Also try organic + sponsored
  const cv = element.metric?.value?.typeSpecificValue?.contentAnalyticsValue;
  return (cv?.organicValue?.long ?? 0) + (cv?.sponsoredValue?.long ?? 0);
}

// ── API Functions ──────────────────────────────────────────────────────

/**
 * Fetch follower trend (daily gains) via DMA Edge Analytics
 */
export async function fetchFollowerTrend(
  headers: Record<string, string>,
  organizationId: string,
  start: Date,
  end: Date
): Promise<{ daily: Record<string, number>; totalFollowers: number }> {
  const pageUrn = `urn:li:organizationalPage:${organizationId}`;
  const startMs = start.getTime();
  const endMs = end.getTime();

  const url = `${API_REST_URL}/dmaOrganizationalPageEdgeAnalytics` +
    `?q=trend` +
    `&organizationalPage=${encodeURIComponent(pageUrn)}` +
    `&analyticsType=FOLLOWER` +
    `&timeIntervals=(timeRange:(start:${startMs},end:${endMs}))`;

  const response = await apiRequest<{ elements?: EdgeAnalyticsElement[] }>(
    'linkedin', url, { headers }, 'linkedin_dma_follower_trend'
  );

  console.log(`[linkedin-dma] EdgeAnalytics FOLLOWER raw: ${JSON.stringify(response).slice(0, 1000)}`);

  const daily: Record<string, number> = {};
  let totalFollowers = 0;

  for (const element of response.elements ?? []) {
    const rangeStart = element.timeIntervals?.timeRange?.start;
    if (!rangeStart) continue;

    const dateKey = new Date(rangeStart).toISOString().slice(0, 10);
    // totalCount may be long or bigDecimal
    const tc = element.value?.totalCount;
    const total = tc?.long ?? (tc?.bigDecimal ? parseFloat(tc.bigDecimal) : 0);
    const organic = element.value?.typeSpecificValue?.followerEdgeAnalyticsValue?.organicValue ?? 0;
    const sponsored = element.value?.typeSpecificValue?.followerEdgeAnalyticsValue?.sponsoredValue ?? 0;

    // The trend returns gains per interval
    daily[dateKey] = organic + sponsored;

    // Track the latest total
    if (total > totalFollowers) {
      totalFollowers = total;
    }
  }

  return { daily, totalFollowers };
}

/**
 * Fetch total follower count via dmaOrganizationalPageFollows paging.total
 * This is more reliable than EdgeAnalytics for getting the current total.
 */
export async function fetchFollowerCount(
  headers: Record<string, string>,
  organizationId: string
): Promise<number> {
  const pageUrn = `urn:li:organizationalPage:${organizationId}`;

  // Request just 1 result — we only need paging.total
  const url = `${API_REST_URL}/dmaOrganizationalPageFollows` +
    `?q=followee` +
    `&followee=${encodeURIComponent(pageUrn)}` +
    `&edgeType=MEMBER_FOLLOWS_ORGANIZATIONAL_PAGE` +
    `&maxPaginationCount=1`;

  const response = await apiRequest<{
    paging?: { total?: number };
    elements?: unknown[];
  }>('linkedin', url, { headers }, 'linkedin_dma_follower_count');

  const total = response.paging?.total ?? 0;
  console.log(`[linkedin-dma] Follower count from dmaOrganizationalPageFollows: ${total}`);
  return total;
}

/**
 * Fetch page-level content analytics trend (daily impressions, clicks, etc.)
 */
export async function fetchPageContentTrend(
  headers: Record<string, string>,
  organizationId: string,
  start: Date,
  end: Date
): Promise<Map<string, {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  comments: number;
  reactions: number;
  reposts: number;
}>> {
  const pageUrn = `urn:li:organizationalPage:${organizationId}`;
  const startMs = start.getTime();
  const endMs = end.getTime();

  const metrics = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,COMMENTS,REACTIONS,REPOSTS)';
  const url = `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
    `?q=trend` +
    `&sourceEntity=${encodeURIComponent(pageUrn)}` +
    `&metricTypes=${metrics}` +
    `&timeIntervals=(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:DAY)`;

  const response = await apiRequest<{ elements?: ContentAnalyticsElement[] }>(
    'linkedin', url, { headers }, 'linkedin_dma_content_trend'
  );

  const dailyMap = new Map<string, {
    impressions: number;
    uniqueImpressions: number;
    clicks: number;
    comments: number;
    reactions: number;
    reposts: number;
  }>();

  for (const element of response.elements ?? []) {
    const rangeStart = element.metric?.timeIntervals?.timeRange?.start;
    if (!rangeStart) continue;

    const dateKey = new Date(rangeStart).toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) ?? {
      impressions: 0, uniqueImpressions: 0, clicks: 0,
      comments: 0, reactions: 0, reposts: 0
    };

    const count = getMetricTotalCount(element);

    switch (element.type) {
      case 'IMPRESSIONS': existing.impressions += count; break;
      case 'UNIQUE_IMPRESSIONS': existing.uniqueImpressions += count; break;
      case 'CLICKS': existing.clicks += count; break;
      case 'COMMENTS': existing.comments += count; break;
      case 'REACTIONS': existing.reactions += count; break;
      case 'REPOSTS': existing.reposts += count; break;
    }

    dailyMap.set(dateKey, existing);
  }

  return dailyMap;
}

/**
 * Fetch list of posts via DMA Feed Contents External
 */
export async function fetchDmaPosts(
  headers: Record<string, string>,
  organizationId: string,
  limit: number
): Promise<string[]> {
  const orgUrn = `urn:li:organization:${organizationId}`;

  // dmaFeedContentsExternal with q=postsByAuthor and author=List(orgUrn)
  const url = `${API_REST_URL}/dmaFeedContentsExternal` +
    `?q=postsByAuthor` +
    `&author=List(${encodeURIComponent(orgUrn)})` +
    `&maxPaginationCount=${limit}`;

  try {
    const response = await apiRequest<{ elements?: FeedContentsElement[] }>(
      'linkedin', url, { headers }, 'linkedin_dma_feed_contents'
    );

    console.log(`[linkedin-dma] dmaFeedContentsExternal returned ${response.elements?.length ?? 0} elements`);

    return (response.elements ?? [])
      .map(e => e.id ?? e.contentUrn)
      .filter((urn): urn is string => !!urn)
      .slice(0, limit);
  } catch (error) {
    console.error('[linkedin-dma] Failed to fetch feed contents:', error);
    return [];
  }
}

/**
 * Fetch post details via /dmaPosts BATCH_GET
 */
export async function fetchPostDetails(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, DmaPostElement>> {
  const posts = new Map<string, DmaPostElement>();

  if (!postUrns.length) return posts;

  // BATCH_GET: /dmaPosts?ids=List(encoded_urn1,encoded_urn2,...)&viewContext=AUTHOR
  // Process in chunks of 20 to avoid URL length issues
  const BATCH_SIZE = 20;
  for (let i = 0; i < postUrns.length; i += BATCH_SIZE) {
    const batch = postUrns.slice(i, i + BATCH_SIZE);
    const encodedIds = batch.map(urn => encodeURIComponent(urn)).join(',');
    const url = `${API_REST_URL}/dmaPosts?ids=List(${encodedIds})&viewContext=AUTHOR`;

    try {
      const response = await apiRequest<{
        results?: Record<string, DmaPostElement>;
        statuses?: Record<string, number>;
        errors?: Record<string, unknown>;
      }>('linkedin', url, { headers }, 'linkedin_dma_post_batch');

      if (response.results) {
        for (const [urn, post] of Object.entries(response.results)) {
          posts.set(urn, post);
        }
      }
    } catch (error) {
      console.error(`[linkedin-dma] Failed to batch fetch posts:`, error);
      // Fallback: fetch individually
      for (const urn of batch) {
        try {
          const encodedUrn = encodeURIComponent(urn);
          const fallbackUrl = `${API_REST_URL}/dmaPosts/${encodedUrn}`;
          const post = await apiRequest<DmaPostElement>(
            'linkedin', fallbackUrl, { headers }, 'linkedin_dma_post_detail'
          );
          posts.set(urn, post);
        } catch (innerError) {
          console.warn(`[linkedin-dma] Failed to fetch post ${urn}:`, innerError);
        }
      }
    }
  }

  return posts;
}

/**
 * Fetch social metadata (reaction/comment counts) for posts
 */
export async function fetchSocialMetadata(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, { reactions: number; comments: number; reposts: number }>> {
  const metadata = new Map<string, { reactions: number; comments: number; reposts: number }>();

  for (const urn of postUrns) {
    try {
      const encodedUrn = encodeURIComponent(urn);
      const url = `${API_REST_URL}/dmaSocialMetadata/${encodedUrn}`;
      const response = await apiRequest<SocialMetadataResponse>(
        'linkedin', url, { headers }, 'linkedin_dma_social_metadata'
      );
      metadata.set(urn, {
        reactions: response.reactionSummary?.totalCount ?? 0,
        comments: response.commentSummary?.totalCount ?? 0,
        reposts: response.shareCount ?? 0,
      });
    } catch (error) {
      // Social metadata may not be available for all posts
      console.warn(`[linkedin-dma] Failed to fetch social metadata for ${urn}:`, error);
    }
  }

  return metadata;
}

/**
 * Fetch post-level analytics (impressions, clicks) for individual posts
 */
export async function fetchPostAnalytics(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, { impressions: number; uniqueImpressions: number; clicks: number }>> {
  const analytics = new Map<string, { impressions: number; uniqueImpressions: number; clicks: number }>();

  for (const urn of postUrns) {
    try {
      const metrics = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS)';
      const url = `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
        `?q=trend` +
        `&sourceEntity=${encodeURIComponent(urn)}` +
        `&metricTypes=${metrics}`;

      const response = await apiRequest<{ elements?: ContentAnalyticsElement[] }>(
        'linkedin', url, { headers }, 'linkedin_dma_post_analytics'
      );

      const data = { impressions: 0, uniqueImpressions: 0, clicks: 0 };
      for (const element of response.elements ?? []) {
        const count = getMetricTotalCount(element);
        switch (element.type) {
          case 'IMPRESSIONS': data.impressions += count; break;
          case 'UNIQUE_IMPRESSIONS': data.uniqueImpressions += count; break;
          case 'CLICKS': data.clicks += count; break;
        }
      }
      analytics.set(urn, data);
    } catch (error) {
      console.warn(`[linkedin-dma] Failed to fetch analytics for ${urn}:`, error);
    }
  }

  return analytics;
}

// ── Connector ──────────────────────────────────────────────────────────

export const linkedinConnector: Connector = {
  platform: 'linkedin',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing LinkedIn access token');
    }

    const headers = buildHeaders(accessToken);

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    now.setUTCHours(23, 59, 59, 999);

    // Initialize daily map with empty metrics
    const dailyMap = new Map<string, DailyMetric>();
    for (let d = new Date(since); d <= now; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      dailyMap.set(date, {
        date,
        impressions: 0,
        reach: 0,
        engagements: 0,
        posts_count: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      });
    }

    const organizationId = normalizeOrganizationId(externalAccountId);

    // 1. Fetch follower data via EdgeAnalytics (primary)
    let totalFollowers = 0;
    try {
      const followerData = await fetchFollowerTrend(headers, organizationId, since, now);
      totalFollowers = followerData.totalFollowers;
      console.log(`[linkedin-dma] EdgeAnalytics: totalFollowers=${totalFollowers}, daily entries=${Object.keys(followerData.daily).length}`);
      for (const [dateKey, count] of Object.entries(followerData.daily)) {
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.followers = (entry.followers ?? 0) + count;
        }
      }
    } catch (error) {
      console.error('[linkedin-dma] Failed to fetch follower trend:', error);
    }

    // Fallback: use dmaOrganizationalPageFollows if EdgeAnalytics returned 0
    if (totalFollowers === 0) {
      try {
        totalFollowers = await fetchFollowerCount(headers, organizationId);
        console.log(`[linkedin-dma] Follows API fallback: totalFollowers=${totalFollowers}`);
      } catch (error) {
        console.error('[linkedin-dma] Failed to fetch follower count (fallback):', error);
      }
    }

    // Set total followers on latest date for cumsum conversion in sync.ts
    const latestDate = Array.from(dailyMap.keys()).sort().slice(-1)[0];
    if (latestDate && totalFollowers > 0) {
      const entry = dailyMap.get(latestDate);
      if (entry) {
        entry.followers = totalFollowers;
      }
    }

    console.log(`[linkedin-dma] Final total followers: ${totalFollowers}`);

    // 2. Fetch page-level content analytics (daily impressions, reactions, etc.)
    try {
      const contentTrend = await fetchPageContentTrend(headers, organizationId, since, now);
      for (const [dateKey, counts] of contentTrend) {
        const entry = dailyMap.get(dateKey);
        if (!entry) continue;
        entry.impressions = (entry.impressions ?? 0) + counts.impressions;
        entry.reach = (entry.reach ?? 0) + counts.uniqueImpressions;
        entry.likes = (entry.likes ?? 0) + counts.reactions;
        entry.comments = (entry.comments ?? 0) + counts.comments;
        entry.shares = (entry.shares ?? 0) + counts.reposts;
        entry.engagements = (entry.engagements ?? 0) + counts.reactions + counts.comments + counts.reposts + counts.clicks;
        entry.views = (entry.views ?? 0) + counts.impressions;
      }
    } catch (error) {
      console.warn('[linkedin-dma] Failed to fetch content trend:', error);
    }

    // 3. Fetch posts
    let postUrns: string[] = [];
    try {
      postUrns = await fetchDmaPosts(headers, organizationId, MAX_POSTS_SYNC);
      console.log(`[linkedin-dma] Fetched ${postUrns.length} post URNs for org ${organizationId}`);
    } catch (error) {
      console.error('[linkedin-dma] Failed to fetch posts list:', error);
    }

    const posts: PostMetric[] = [];

    if (postUrns.length > 0) {
      // 4. Fetch post details, social metadata, and analytics in parallel
      const [postDetails, socialMeta, postAnalytics] = await Promise.all([
        fetchPostDetails(headers, postUrns),
        fetchSocialMetadata(headers, postUrns),
        fetchPostAnalytics(headers, postUrns),
      ]);

      for (const urn of postUrns) {
        const detail = postDetails.get(urn);
        const meta = socialMeta.get(urn);
        const analytics = postAnalytics.get(urn);

        const createdAt = detail?.publishedAt ?? detail?.created?.time ?? detail?.createdAt ?? Date.now();
        const postedAt = new Date(createdAt).toISOString();
        const caption = detail?.commentary?.slice(0, 280) || 'LinkedIn post';

        const reactions = meta?.reactions ?? 0;
        const comments = meta?.comments ?? 0;
        const reposts = meta?.reposts ?? 0;
        const impressions = analytics?.impressions ?? 0;
        const uniqueImpressions = analytics?.uniqueImpressions ?? 0;
        const clicks = analytics?.clicks ?? 0;
        const engagements = reactions + comments + reposts + clicks;

        // Extract share/ugcPost ID for URL
        const postId = urn.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');

        posts.push({
          external_post_id: urn,
          posted_at: postedAt,
          url: `https://www.linkedin.com/feed/update/${urn}`,
          caption,
          media_type: detectLinkedInMediaType(detail?.content),
          metrics: {
            impressions,
            reach: uniqueImpressions,
            engagements,
            likes: reactions,
            comments,
            shares: reposts,
            clicks
          },
          raw_json: detail as Record<string, unknown> ?? {}
        });

        // Count posts per day
        const dateKey = postedAt.slice(0, 10);
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.posts_count = (entry.posts_count ?? 0) + 1;
        }
      }
    }

    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  }
};
