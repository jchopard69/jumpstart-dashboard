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
import { apiRequest, SocialApiError } from '../core/api-client';
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
 * Fetch total follower count using a cascade of strategies:
 *
 * 1. organizationalEntityFollowerStatistics (REST API) — gives exact total
 *    but requires r_organization_social scope. May work with DMA token.
 * 2. networkSizes (v2 API) — lightweight, gives firstDegreeSize.
 * 3. dmaOrganizationalPageFollows element enumeration — DMA fallback,
 *    but only returns a subset of followers (DMA/portability scope).
 *
 * Each method is tried silently; first success wins.
 */
export async function fetchFollowerCount(
  headers: Record<string, string>,
  organizationId: string
): Promise<number> {
  const orgUrn = `urn:li:organization:${organizationId}`;

  // Strategy 1: organizationalEntityFollowerStatistics (REST)
  try {
    const url = `${API_REST_URL}/organizationalEntityFollowerStatistics` +
      `?q=organizationalEntity` +
      `&organizationalEntity=${encodeURIComponent(orgUrn)}`;

    const response = await apiRequest<{
      elements?: Array<{
        followerCounts?: {
          organicFollowerCount?: number;
          paidFollowerCount?: number;
        };
      }>;
    }>('linkedin', url, { headers }, 'linkedin_follower_stats', true);

    const counts = response.elements?.[0]?.followerCounts;
    if (counts) {
      const total = (counts.organicFollowerCount ?? 0) + (counts.paidFollowerCount ?? 0);
      console.log(`[linkedin-dma] followerStatistics: organic=${counts.organicFollowerCount}, paid=${counts.paidFollowerCount}, total=${total}`);
      if (total > 0) return total;
    }
  } catch {
    console.log('[linkedin-dma] organizationalEntityFollowerStatistics not available (likely missing scope)');
  }

  // Strategy 2: networkSizes (v2)
  try {
    const v2Url = `${LINKEDIN_CONFIG.apiV2Url}/networkSizes/${encodeURIComponent(orgUrn)}` +
      `?edgeType=CompanyFollowedByMember`;

    const response = await apiRequest<{
      firstDegreeSize?: number;
    }>('linkedin', v2Url, { headers }, 'linkedin_network_sizes', true);

    if (response.firstDegreeSize && response.firstDegreeSize > 0) {
      console.log(`[linkedin-dma] networkSizes: firstDegreeSize=${response.firstDegreeSize}`);
      return response.firstDegreeSize;
    }
  } catch {
    console.log('[linkedin-dma] networkSizes not available (likely missing scope)');
  }

  // Strategy 3: DMA element enumeration (partial — only DMA-visible followers)
  const pageUrn = `urn:li:organizationalPage:${organizationId}`;
  try {
    const url = `${API_REST_URL}/dmaOrganizationalPageFollows` +
      `?q=followee` +
      `&followee=${encodeURIComponent(pageUrn)}` +
      `&edgeType=MEMBER_FOLLOWS_ORGANIZATIONAL_PAGE` +
      `&maxPaginationCount=1`;

    const response = await apiRequest<{
      paging?: { total?: number };
      elements?: unknown[];
    }>('linkedin', url, { headers }, 'linkedin_dma_follower_count', true);

    const dmaCount = response.elements?.length ?? 0;
    console.warn(`[linkedin-dma] DMA enumeration only: ${dmaCount} followers visible (partial — DMA scope only returns a subset). Real count may be much higher.`);
    // Don't return partial DMA count — it's misleading (26 vs 4434)
    // Return 0 so the dashboard shows "—" rather than a wrong number
  } catch {
    console.log('[linkedin-dma] dmaOrganizationalPageFollows also failed');
  }

  console.warn(`[linkedin-dma] Could not determine follower count for org=${organizationId}. Add r_organization_social scope for accurate follower stats.`);
  return 0;
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
      throw new Error('Missing LinkedIn access token — needs_reauth');
    }

    console.log(`[linkedin-dma] Starting sync for org=${externalAccountId}`);
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
    let dailyGainsTotal = 0;
    try {
      const followerData = await fetchFollowerTrend(headers, organizationId, since, now);
      totalFollowers = followerData.totalFollowers;
      console.log(`[linkedin-dma] EdgeAnalytics: totalFollowers=${totalFollowers}, daily entries=${Object.keys(followerData.daily).length}`);
      for (const [dateKey, count] of Object.entries(followerData.daily)) {
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.followers = (entry.followers ?? 0) + count;
          dailyGainsTotal += count;
        }
      }
    } catch (error) {
      if (error instanceof SocialApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        console.error(`[linkedin-dma] Auth error fetching follower trend (${error.statusCode}): needs_reauth or missing_permission`);
        throw new Error(`LinkedIn auth error (${error.statusCode}) — needs_reauth`);
      }
      console.error('[linkedin-dma] Failed to fetch follower trend:', error);
    }

    // Fallback: use dmaOrganizationalPageFollows if EdgeAnalytics returned 0
    if (totalFollowers === 0) {
      try {
        const fallbackCount = await fetchFollowerCount(headers, organizationId);
        console.log(`[linkedin-dma] Follows API fallback: returned=${fallbackCount}`);
        // Only trust values > 1 (value of 1 is a known DMA pagination bug)
        if (fallbackCount > 1) {
          totalFollowers = fallbackCount;
        } else {
          console.warn(`[linkedin-dma] Follows API returned ${fallbackCount} — ignoring (likely pagination artifact)`);
        }
      } catch (error) {
        console.error('[linkedin-dma] Failed to fetch follower count (fallback):', error);
      }
    }

    // Set total followers on latest date for cumsum conversion in sync.ts.
    // IMPORTANT: sync.ts treats all metric.followers values as deltas (gains)
    // and accumulates them. So we must NOT put the absolute total here directly.
    // Instead, we set the total on the latest date ONLY — sync.ts will detect
    // this is much larger than daily gains and use it as the cumulative anchor.
    const latestDate = Array.from(dailyMap.keys()).sort().slice(-1)[0];
    if (latestDate && totalFollowers > 0) {
      const entry = dailyMap.get(latestDate);
      if (entry) {
        // Clear the daily gain on the latest date — replace with the total.
        // sync.ts cumsum will add baseline + gains_day1..day29 + this value.
        // Since we want the final result to equal totalFollowers, we set
        // the latest date's value = totalFollowers (sync.ts handles it).
        entry.followers = totalFollowers;
      }
    }

    console.log(`[linkedin-dma] Final: totalFollowers=${totalFollowers}, dailyGainsTotal=${dailyGainsTotal}, orgId=${organizationId}`);

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
