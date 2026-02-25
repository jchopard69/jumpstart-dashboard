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
const MAX_POST_METRICS_SYNC = 15;

// ── Types ──────────────────────────────────────────────────────────────

type NumericCount = {
  long?: number | string;
  bigDecimal?: number | string;
};

type FollowerEdgeAnalyticsValue = {
  organicValue?: number | NumericCount;
  sponsoredValue?: number | NumericCount;
  organicFollowerGain?: number | NumericCount;
  sponsoredFollowerGain?: number | NumericCount;
};

type EdgeAnalyticsValue = {
  totalCount?: NumericCount;
  typeSpecificValue?: {
    followerEdgeAnalyticsValue?: FollowerEdgeAnalyticsValue;
    visitorEdgeAnalyticsValue?: {
      desktopCount?: number;
      mobileCount?: number;
      uniqueCount?: number;
    };
  };
};

type EdgeAnalyticsElement = {
  type?: string; // FOLLOWER | VISITOR
  value?: EdgeAnalyticsValue;
  metric?: {
    timeIntervals?: {
      timeRange?: { start?: number; end?: number };
    };
    value?: EdgeAnalyticsValue;
  };
  timeIntervals?: {
    timeRange?: { start?: number; end?: number };
  };
};

type ContentAnalyticsValue = {
  totalCount?: NumericCount;
  typeSpecificValue?: {
    contentAnalyticsValue?: {
      organicValue?: NumericCount;
      sponsoredValue?: NumericCount;
    };
  };
};

type ContentAnalyticsElement = {
  type: string; // IMPRESSIONS | UNIQUE_IMPRESSIONS | CLICKS | COMMENTS | REACTIONS | REPOSTS
  metric?: {
    timeIntervals?: { timeRange?: { start?: number; end?: number } };
    value?: ContentAnalyticsValue;
  };
  timeIntervals?: { timeRange?: { start?: number; end?: number } };
  value?: ContentAnalyticsValue;
  sourceEntity?: string;
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
  socialDetail?: {
    totalShareStatistics?: {
      shareCount?: number;
      likeCount?: number;
      commentCount?: number;
      impressionCount?: number;
      uniqueImpressionCount?: number;
      clickCount?: number;
    };
  };
  // Legacy fields kept for compat
  createdAt?: number;
};

type FeedContentsElement = {
  id?: string;
  // Legacy field name
  contentUrn?: string;
  type?: string;
};

type SocialMetadataResponse = {
  reactionSummary?: { totalCount?: number };
  commentSummary?: { totalCount?: number };
  shareCount?: number;
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
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': API_VERSION,
  };
}

export function normalizeOrganizationId(value: string): string {
  return value
    .replace('urn:li:organization:', '')
    .replace('urn:li:organizationalPage:', '');
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const longValue = record.long;
    if (typeof longValue === 'number' && Number.isFinite(longValue)) return longValue;
    if (typeof longValue === 'string' && longValue.trim().length > 0) {
      const parsedLong = Number(longValue);
      if (Number.isFinite(parsedLong)) return parsedLong;
    }
    const decimalValue = record.bigDecimal;
    if (typeof decimalValue === 'number' && Number.isFinite(decimalValue)) return decimalValue;
    if (typeof decimalValue === 'string' && decimalValue.trim().length > 0) {
      const parsedDecimal = Number(decimalValue);
      if (Number.isFinite(parsedDecimal)) return parsedDecimal;
    }
  }
  return 0;
}

function getNestedValue(input: unknown, path: string[]): unknown {
  let current: unknown = input;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function getFirstNumber(input: unknown, paths: string[][]): number {
  for (const path of paths) {
    const value = toNumber(getNestedValue(input, path));
    if (value !== 0) return value;
  }
  return 0;
}

function getEdgeElementValue(element: EdgeAnalyticsElement): EdgeAnalyticsValue | undefined {
  return element.value ?? element.metric?.value;
}

function getEdgeRangeStartMs(element: EdgeAnalyticsElement): number | null {
  const rawStart = element.timeIntervals?.timeRange?.start ?? element.metric?.timeIntervals?.timeRange?.start;
  const start = toNumber(rawStart);
  if (start <= 0) return null;
  return normalizeLinkedInTimestampMs(start);
}

function getFollowerTotal(value: EdgeAnalyticsValue | undefined): number {
  const organicCount = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicFollowerCount'],
  ]);
  const sponsoredCount = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredFollowerCount'],
  ]);
  const summedBreakdown = organicCount + sponsoredCount;

  return Math.max(
    toNumber(value?.totalCount),
    getFirstNumber(value, [
      ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'totalCount'],
    ]),
    summedBreakdown
  );
}

function getFollowerGains(value: EdgeAnalyticsValue | undefined): number {
  const organic = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicValue'],
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicFollowerGain'],
  ]);
  const sponsored = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredValue'],
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredFollowerGain'],
  ]);
  return organic + sponsored;
}

export function normalizeLinkedInTimestampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  // Some LinkedIn payloads provide epoch seconds, others epoch milliseconds.
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function toLinkedInIsoDate(value?: number): string {
  if (!value || !Number.isFinite(value)) return new Date().toISOString();
  return new Date(normalizeLinkedInTimestampMs(value)).toISOString();
}

export function parseFollowerTrendElements(elements?: EdgeAnalyticsElement[]): { daily: Record<string, number>; totalFollowers: number } {
  const rows: Array<{ startMs: number; dateKey: string; total: number; explicitGain: number }> = [];

  for (const element of elements ?? []) {
    const rangeStart = getEdgeRangeStartMs(element);
    if (!rangeStart) continue;

    const value = getEdgeElementValue(element);
    const total = getFollowerTotal(value);
    const explicitGain = getFollowerGains(value);
    const dateKey = new Date(rangeStart).toISOString().slice(0, 10);
    rows.push({ startMs: rangeStart, dateKey, total, explicitGain });
  }

  rows.sort((a, b) => a.startMs - b.startMs);

  const daily: Record<string, number> = {};
  let totalFollowers = 0;
  let previousTotal: number | null = null;

  for (const row of rows) {
    totalFollowers = Math.max(totalFollowers, row.total);

    let gain = row.explicitGain;
    // Some payload variants omit daily gains but include cumulative totals.
    if (gain === 0 && row.total > 0 && previousTotal != null && row.total >= previousTotal) {
      gain = row.total - previousTotal;
    }

    daily[row.dateKey] = (daily[row.dateKey] ?? 0) + gain;

    if (row.total > 0) {
      previousTotal = row.total;
    }
  }

  return { daily, totalFollowers };
}

function getMetricTotalCount(element: ContentAnalyticsElement): number {
  const value = element.metric?.value ?? element.value;
  const totalCount = toNumber(value?.totalCount);
  if (totalCount > 0) return totalCount;
  // Also try organic + sponsored
  const cv = value?.typeSpecificValue?.contentAnalyticsValue;
  return toNumber(cv?.organicValue) + toNumber(cv?.sponsoredValue);
}

// ── API Functions ──────────────────────────────────────────────────────

/**
 * Resolve organization ID to organizationalPage URN via DMA Page Profiles.
 * LinkedIn docs say: "convert it to an organizationalPage using the
 * OrganizationalPage pageEntity finder". The page URN may differ from org ID.
 */
export async function resolveOrganizationalPageUrn(
  headers: Record<string, string>,
  organizationId: string
): Promise<string> {
  const orgUrn = `urn:li:organization:${organizationId}`;
  const defaultPageUrn = `urn:li:organizationalPage:${organizationId}`;

  try {
    const url = `${API_REST_URL}/dmaOrganizationalPageProfiles` +
      `?q=pageEntity` +
      `&pageEntity=(organization:${encodeURIComponent(orgUrn)})`;

    const response = await apiRequest<{
      elements?: Array<{
        entityUrn?: string;
        primaryPageEntity?: { organization?: string };
      }>;
    }>('linkedin', url, { headers }, 'linkedin_dma_page_resolve', true);

    const resolved = response.elements?.[0]?.entityUrn;
    if (resolved) {
      console.log(`[linkedin-dma] Resolved page URN: ${resolved} (org=${orgUrn})`);
      return resolved;
    }
  } catch {
    // Fallback to default
  }

  console.log(`[linkedin-dma] Using default page URN: ${defaultPageUrn}`);
  return defaultPageUrn;
}

/**
 * Fetch follower trend (daily gains) via DMA Edge Analytics
 */
export async function fetchFollowerTrend(
  headers: Record<string, string>,
  organizationId: string,
  start: Date,
  end: Date,
  pageUrn?: string
): Promise<{ daily: Record<string, number>; totalFollowers: number }> {
  if (!pageUrn) pageUrn = `urn:li:organizationalPage:${organizationId}`;
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

  console.log(`[linkedin-dma] EdgeAnalytics FOLLOWER: ${response.elements?.length ?? 0} elements`);
  return parseFollowerTrendElements(response.elements);
}

/**
 * Fetch total follower count using a cascade of strategies:
 *
 * 1. organizationalEntityFollowerStatistics (REST API) — gives exact total
 *    but requires r_organization_social scope.
 * 2. networkSizes (v2 API) — lightweight, gives firstDegreeSize.
 * 3. dmaOrganizationalPageFollows with cursor pagination — DMA endpoint,
 *    uses nextPaginationCursor to enumerate ALL followers page by page.
 *
 * Each method is tried silently; first success wins.
 */
export async function fetchFollowerCount(
  headers: Record<string, string>,
  organizationId: string,
  resolvedPageUrn?: string
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

  // Strategy 3: dmaOrganizationalPageFollows with cursor pagination.
  // Use the resolved organizationalPage URN — the page ID may differ from org ID.
  const pageUrn = resolvedPageUrn ?? `urn:li:organizationalPage:${organizationId}`;
  const PAGE_SIZE = 100;

  try {
    const firstUrl = `${API_REST_URL}/dmaOrganizationalPageFollows` +
      `?q=followee` +
      `&followee=${encodeURIComponent(pageUrn)}` +
      `&edgeType=MEMBER_FOLLOWS_ORGANIZATIONAL_PAGE` +
      `&maxPaginationCount=${PAGE_SIZE}`;

    const response = await apiRequest<{
      paging?: { total?: number };
      metadata?: { nextPaginationCursor?: string | null };
      elements?: unknown[];
    }>('linkedin', firstUrl, { headers }, 'linkedin_dma_follower_count', true);

    const elementsCount = response.elements?.length ?? 0;
    const pagingTotal = response.paging?.total;
    console.log(`[linkedin-dma] DMA followers raw paging: ${JSON.stringify(response.paging)}, metadata: ${JSON.stringify(response.metadata)}, elements: ${elementsCount}`);

    // The endpoint has strict per-minute limits. Prefer paging.total from the
    // first page and avoid high-frequency cursor loops that trigger 429.
    if (pagingTotal != null && pagingTotal > 0) {
      const best = Math.max(pagingTotal, elementsCount);
      console.log(`[linkedin-dma] DMA follower count from first page: ${best} (paging.total=${pagingTotal}, elements=${elementsCount})`);
      return best;
    }

    const hasMore = !!response.metadata?.nextPaginationCursor;
    if (hasMore) {
      console.log('[linkedin-dma] DMA follows has pagination cursor but paging.total is unavailable; skipping extra pages to avoid endpoint throttle.');
    }

    if (elementsCount > 0) {
      console.log(`[linkedin-dma] DMA follower count from first page elements: ${elementsCount}`);
      return elementsCount;
    }
  } catch (error) {
    console.log('[linkedin-dma] DMA follower count failed:', error instanceof Error ? error.message : error);
  }

  console.log(`[linkedin-dma] Could not determine follower count for org=${organizationId}`);
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
    const rangeStart = element.metric?.timeIntervals?.timeRange?.start ?? element.timeIntervals?.timeRange?.start;
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
    console.log('[linkedin-dma] Failed to fetch feed contents:', error instanceof Error ? error.message : error);
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
    } catch {
      // Batch failed — fallback to individual fetches
      for (const urn of batch) {
        try {
          const encodedUrn = encodeURIComponent(urn);
          const fallbackUrl = `${API_REST_URL}/dmaPosts/${encodedUrn}`;
          const post = await apiRequest<DmaPostElement>(
            'linkedin', fallbackUrl, { headers }, 'linkedin_dma_post_detail', true
          );
          posts.set(urn, post);
        } catch {
          // Skip individual post
        }
      }
    }
  }

  return posts;
}


/**
 * Fetch social metadata (reaction/comment/share counts) for posts.
 * This endpoint can be unavailable with some DMA configurations (404).
 */
export async function fetchSocialMetadata(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, { reactions: number; comments: number; reposts: number }>> {
  const metadata = new Map<string, { reactions: number; comments: number; reposts: number }>();
  if (!postUrns.length) return metadata;

  for (let i = 0; i < postUrns.length; i++) {
    const urn = postUrns[i];
    try {
      const encodedUrn = encodeURIComponent(urn);
      const url = `${API_REST_URL}/dmaSocialMetadata/${encodedUrn}`;
      const response = await apiRequest<SocialMetadataResponse>(
        'linkedin',
        url,
        { headers },
        'linkedin_dma_social_metadata',
        true
      );
      metadata.set(urn, {
        reactions: response.reactionSummary?.totalCount ?? 0,
        comments: response.commentSummary?.totalCount ?? 0,
        reposts: response.shareCount ?? 0,
      });
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 404 && i === 0) {
        console.log(`[linkedin-dma] dmaSocialMetadata not available (404), skipping ${postUrns.length} posts`);
        return metadata;
      }
      if (error instanceof SocialApiError && error.statusCode === 429) {
        console.log('[linkedin-dma] dmaSocialMetadata rate-limited, stopping post metadata fetch');
        break;
      }
      // Ignore errors on individual posts.
    }
  }

  return metadata;
}

/**
 * Fetch post-level analytics via dmaOrganizationalPageContentAnalytics.
 * Limited to a small subset to reduce DMA resource throttle pressure.
 */
export async function fetchPostAnalytics(
  headers: Record<string, string>,
  postUrns: string[],
  maxRequests = MAX_POST_METRICS_SYNC
): Promise<Map<string, {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
}>> {
  const analytics = new Map<string, {
    impressions: number;
    uniqueImpressions: number;
    clicks: number;
    reactions: number;
    comments: number;
    reposts: number;
  }>();

  const targetUrns = postUrns.slice(0, maxRequests);
  if (postUrns.length > targetUrns.length) {
    console.log(`[linkedin-dma] Post analytics limited to ${targetUrns.length}/${postUrns.length} posts to reduce DMA throttling`);
  }

  for (const urn of targetUrns) {
    try {
      const metrics = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,REACTIONS,COMMENTS,REPOSTS)';
      const url = `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
        `?q=trend` +
        `&sourceEntity=${encodeURIComponent(urn)}` +
        `&metricTypes=${metrics}`;

      const response = await apiRequest<{ elements?: ContentAnalyticsElement[] }>(
        'linkedin', url, { headers }, 'linkedin_dma_post_analytics', true
      );

      const data = { impressions: 0, uniqueImpressions: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0 };
      for (const element of response.elements ?? []) {
        const count = getMetricTotalCount(element);
        switch (element.type) {
          case 'IMPRESSIONS': data.impressions += count; break;
          case 'UNIQUE_IMPRESSIONS': data.uniqueImpressions += count; break;
          case 'CLICKS': data.clicks += count; break;
          case 'REACTIONS': data.reactions += count; break;
          case 'COMMENTS': data.comments += count; break;
          case 'REPOSTS': data.reposts += count; break;
        }
      }
      analytics.set(urn, data);
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 429) {
        console.log('[linkedin-dma] Post analytics rate-limited, stopping post analytics fetch');
        break;
      }
      // Silently skip — post analytics may not be available for all posts.
    }
  }

  return analytics;
}

function getPostCaption(detail?: DmaPostElement): string {
  if (!detail) return 'LinkedIn post';
  if (typeof detail.commentary === 'string' && detail.commentary.trim().length > 0) {
    return detail.commentary.slice(0, 280);
  }
  const commentaryText = getNestedValue(detail.commentary, ['text']);
  if (typeof commentaryText === 'string' && commentaryText.trim().length > 0) {
    return commentaryText.slice(0, 280);
  }
  return 'LinkedIn post';
}

function getPostDetailStats(detail?: DmaPostElement): {
  impressions: number;
  reach: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
} {
  if (!detail) {
    return { impressions: 0, reach: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0 };
  }

  const impressions = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'impressionCount'],
    ['distribution', 'totalShareStatistics', 'impressionCount'],
  ]);
  const reach = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'uniqueImpressionCount'],
    ['distribution', 'totalShareStatistics', 'uniqueImpressionCount'],
  ]);
  const clicks = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'clickCount'],
    ['distribution', 'totalShareStatistics', 'clickCount'],
  ]);
  const reactions = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'likeCount'],
    ['distribution', 'totalShareStatistics', 'likeCount'],
  ]);
  const comments = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'commentCount'],
    ['distribution', 'totalShareStatistics', 'commentCount'],
  ]);
  const reposts = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'shareCount'],
    ['distribution', 'totalShareStatistics', 'shareCount'],
  ]);

  return { impressions, reach, clicks, reactions, comments, reposts };
}

// ── Connector ──────────────────────────────────────────────────────────

export const linkedinConnector: Connector = {
  platform: 'linkedin',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing LinkedIn access token — needs_reauth');
    }

    console.log(`[linkedin-dma] Starting sync for org=${externalAccountId}, LinkedIn-Version=${API_VERSION}`);
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

    // Resolve the organizationalPage URN (may differ from org ID)
    const resolvedPageUrn = await resolveOrganizationalPageUrn(headers, organizationId);

    // 1. Fetch follower data via EdgeAnalytics (primary)
    let totalFollowers = 0;
    let dailyGainsTotal = 0;
    try {
      const followerData = await fetchFollowerTrend(headers, organizationId, since, now, resolvedPageUrn);
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
      console.log('[linkedin-dma] Failed to fetch follower trend:', error instanceof Error ? error.message : error);
    }

    // Fallback: use fetchFollowerCount cascade if EdgeAnalytics returned 0
    if (totalFollowers === 0) {
      try {
        const fallbackCount = await fetchFollowerCount(headers, organizationId, resolvedPageUrn);
        if (fallbackCount > 1) {
          totalFollowers = fallbackCount;
          console.log(`[linkedin-dma] Follower count fallback: ${fallbackCount}`);
        }
      } catch (error) {
        console.log('[linkedin-dma] Follower count fallback failed:', error instanceof Error ? error.message : error);
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
    let contentTrendLoaded = false;
    let contentTrendRateLimited = false;
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
      contentTrendLoaded = true;
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 429) {
        contentTrendRateLimited = true;
      }
      console.log('[linkedin-dma] Failed to fetch content trend:', error instanceof Error ? error.message : error);
    }

    // 3. Fetch posts
    let postUrns: string[] = [];
    try {
      postUrns = await fetchDmaPosts(headers, organizationId, MAX_POSTS_SYNC);
      console.log(`[linkedin-dma] Fetched ${postUrns.length} post URNs for org ${organizationId}`);
    } catch (error) {
      console.log('[linkedin-dma] Failed to fetch posts list:', error instanceof Error ? error.message : error);
    }

    const posts: PostMetric[] = [];

    if (postUrns.length > 0) {
      // 4. Fetch post details and post-level metrics in parallel
      const metricsUrns = postUrns.slice(0, MAX_POST_METRICS_SYNC);
      const [postDetails, socialMetadata, postAnalytics] = await Promise.all([
        fetchPostDetails(headers, postUrns),
        fetchSocialMetadata(headers, metricsUrns),
        contentTrendRateLimited
          ? Promise.resolve(new Map<string, {
            impressions: number;
            uniqueImpressions: number;
            clicks: number;
            reactions: number;
            comments: number;
            reposts: number;
          }>())
          : fetchPostAnalytics(headers, metricsUrns, MAX_POST_METRICS_SYNC),
      ]);

      for (const urn of postUrns) {
        const detail = postDetails.get(urn);
        const social = socialMetadata.get(urn);
        const analytics = postAnalytics.get(urn);
        const detailStats = getPostDetailStats(detail);

        const createdAt = detail?.publishedAt ?? detail?.created?.time ?? detail?.createdAt ?? Date.now();
        const postedAt = toLinkedInIsoDate(createdAt);
        const caption = getPostCaption(detail);

        const reactions = analytics?.reactions ?? social?.reactions ?? detailStats.reactions;
        const comments = analytics?.comments ?? social?.comments ?? detailStats.comments;
        const reposts = analytics?.reposts ?? social?.reposts ?? detailStats.reposts;
        const impressions = analytics?.impressions ?? detailStats.impressions;
        const uniqueImpressions = analytics?.uniqueImpressions ?? detailStats.reach;
        const clicks = analytics?.clicks ?? detailStats.clicks;
        const engagements = reactions + comments + reposts + clicks;

        const metrics: Record<string, number> = {};
        if (impressions > 0) metrics.impressions = impressions;
        if (uniqueImpressions > 0) metrics.reach = uniqueImpressions;
        if (engagements > 0) metrics.engagements = engagements;
        if (reactions > 0) metrics.likes = reactions;
        if (comments > 0) metrics.comments = comments;
        if (reposts > 0) metrics.shares = reposts;
        if (clicks > 0) metrics.clicks = clicks;

        posts.push({
          external_post_id: urn,
          posted_at: postedAt,
          url: `https://www.linkedin.com/feed/update/${urn}`,
          caption,
          media_type: detectLinkedInMediaType(detail?.content),
          metrics,
          raw_json: detail as Record<string, unknown> ?? {}
        });

        // Count posts per day
        const dateKey = postedAt.slice(0, 10);
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.posts_count = (entry.posts_count ?? 0) + 1;
          // If page-level trend is unavailable, fallback to post-level metrics.
          if (!contentTrendLoaded) {
            entry.impressions = (entry.impressions ?? 0) + impressions;
            entry.reach = (entry.reach ?? 0) + (uniqueImpressions || impressions);
            entry.likes = (entry.likes ?? 0) + reactions;
            entry.comments = (entry.comments ?? 0) + comments;
            entry.shares = (entry.shares ?? 0) + reposts;
            entry.engagements = (entry.engagements ?? 0) + engagements;
            entry.views = (entry.views ?? 0) + impressions;
          }
        }
      }
    }

    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  }
};
