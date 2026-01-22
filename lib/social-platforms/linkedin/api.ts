/**
 * LinkedIn DMA Pages API client for fetching analytics
 */

import { LINKEDIN_CONFIG, getLinkedInVersion } from './config';
import { apiRequest, SocialApiError } from '../core/api-client';
import type { Connector } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();

type DmaAnalyticsValue = {
  totalCount?: { long?: number; bigDecimal?: string };
  typeSpecificValue?: {
    contentAnalyticsValue?: {
      organicValue?: { long?: number; bigDecimal?: string };
      sponsoredValue?: { long?: number; bigDecimal?: string };
    };
  };
};

type DmaAnalyticsElement = {
  type?: string;
  metric?: {
    timeIntervals?: {
      timeRange?: { start?: number; end?: number };
    };
    value?: DmaAnalyticsValue;
  };
  sourceEntity?: string;
};

type DmaAnalyticsResponse = {
  elements?: DmaAnalyticsElement[];
};

type TrendCounts = {
  impressions: number;
  uniqueImpressions: number;
  comments: number;
  reactions: number;
  reposts: number;
  clicks: number;
};

type DmaFeedContentsResponse = {
  elements?: Array<string | Record<string, unknown>>;
  metadata?: {
    paginationCursorMetdata?: {
      nextPaginationCursor?: string;
    };
  };
  paging?: Record<string, unknown>;
};

type DmaPostsResponse = {
  results?: Record<string, Record<string, unknown>>;
  statuses?: Record<string, number>;
};

// Supported metrics per DMA doc: IMPRESSIONS, UNIQUE_IMPRESSIONS, COMMENTS, REACTIONS, REPOSTS, CLICKS
const METRIC_TYPES = ["IMPRESSIONS", "UNIQUE_IMPRESSIONS", "COMMENTS", "REACTIONS", "REPOSTS", "CLICKS"];
const MAX_POSTS_SYNC = 50;

function parseCount(value?: DmaAnalyticsValue): number {
  if (!value) return 0;
  const total = value.totalCount?.long ?? (value.totalCount?.bigDecimal ? Number(value.totalCount.bigDecimal) : 0);
  const organic = value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.long ??
    (value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal
      ? Number(value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal)
      : 0);
  return total || organic || 0;
}

function createEmptyTrendCounts(): TrendCounts {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    comments: 0,
    reactions: 0,
    reposts: 0,
    clicks: 0,
  };
}

function addTrendCount(target: TrendCounts, type: string | undefined, count: number) {
  switch (type) {
    case "IMPRESSIONS":
      target.impressions += count;
      break;
    case "UNIQUE_IMPRESSIONS":
      target.uniqueImpressions += count;
      break;
    case "COMMENTS":
      target.comments += count;
      break;
    case "REACTIONS":
      target.reactions += count;
      break;
    case "REPOSTS":
      target.reposts += count;
      break;
    case "CLICKS":
      target.clicks += count;
      break;
    default:
      break;
  }
}

function encodeRFC3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildTimeIntervalQueries(start: Date, end: Date, granularity?: "DAY") {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const base = `(timeRange:(start:${startMs},end:${endMs})${granularity ? `,timeGranularityType:${granularity}` : ""})`;
  return [
    { label: "timeIntervals_encoded", query: `timeIntervals=${encodeRFC3986(base)}` },
    { label: "timeIntervals_raw", query: `timeIntervals=${base}` },
  ];
}

function isTimeIntervalsError(error: unknown): boolean {
  if (!(error instanceof SocialApiError)) return false;
  const raw = error.rawError as Record<string, unknown> | undefined;
  const details = raw?.errorDetails as Record<string, unknown> | undefined;
  const inputErrors = details?.inputErrors as Array<Record<string, unknown>> | undefined;
  if (!inputErrors) return false;
  return inputErrors.some((item) => {
    const input = item.input as Record<string, unknown> | undefined;
    const inputPath = input?.inputPath as Record<string, unknown> | undefined;
    return inputPath?.fieldPath === "timeIntervals";
  });
}

async function fetchTrendAnalytics(
  headers: Record<string, string>,
  sourceEntity: string,
  start: Date,
  end: Date,
  endpointName: string
): Promise<DmaAnalyticsResponse> {
  const metricsParam = `List(${METRIC_TYPES.join(',')})`;
  const timeIntervalsVariants = buildTimeIntervalQueries(start, end, "DAY");
  let lastError: unknown = null;

  for (const variant of timeIntervalsVariants) {
    const baseQuery = `q=trend&sourceEntity=${encodeURIComponent(sourceEntity)}&metricTypes=${metricsParam}`;
    const analyticsUrl = `${API_URL}/dmaOrganizationalPageContentAnalytics?${baseQuery}&${(variant as { query: string }).query}`;
    console.log('[linkedin] dma_content_trend url:', analyticsUrl, 'variant:', (variant as { label: string }).label);
    try {
      return await apiRequest<DmaAnalyticsResponse>(
        'linkedin',
        analyticsUrl,
        { headers },
        endpointName
      );
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('LinkedIn DMA trend failed');
}

type EdgeAnalyticsElement = {
  type?: string;
  value?: DmaAnalyticsValue;
  timeIntervals?: {
    timeRange?: { start?: number; end?: number };
  };
  organizationalPage?: string;
};

type EdgeAnalyticsResponse = {
  elements?: EdgeAnalyticsElement[];
};

async function fetchFollowerTrend(
  headers: Record<string, string>,
  organizationalPageUrn: string,
  start: Date,
  end: Date
): Promise<Record<string, number>> {
  const timeQueries = buildTimeIntervalQueries(start, end, "DAY");
  let lastError: unknown = null;

  for (const variant of timeQueries) {
    const url = `${API_URL}/dmaOrganizationalPageEdgeAnalytics` +
      `?q=trend&organizationalPage=${encodeURIComponent(organizationalPageUrn)}` +
      `&analyticsType=FOLLOWER&${(variant as { query: string }).query}`;

    try {
      const response = await apiRequest<EdgeAnalyticsResponse>(
        "linkedin",
        url,
        { headers },
        "dma_page_followers_trend"
      );
      const daily: Record<string, number> = {};
      for (const element of response.elements ?? []) {
        const startMs = element.timeIntervals?.timeRange?.start;
        if (!startMs) continue;
        const dateKey = new Date(startMs).toISOString().slice(0, 10);
        const count = parseCount(element.value);
        daily[dateKey] = (daily[dateKey] ?? 0) + count;
      }
      return daily;
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("LinkedIn DMA follower trend failed");
}

async function resolveOrganizationalPageId(
  headers: Record<string, string>,
  externalAccountId: string
): Promise<string> {
  const orgsUrl = `${API_URL}/dmaOrganizations?ids=List(${externalAccountId})`;
  try {
    const response = await apiRequest<{ results?: Record<string, Record<string, unknown>> }>(
      'linkedin',
      orgsUrl,
      { headers },
      'dma_org_lookup'
    );
    const result = response.results?.[externalAccountId];
    const pageUrn = result?.organizationalPage as string | undefined;
    const pageId = pageUrn?.replace('urn:li:organizationalPage:', '');
    return pageId || externalAccountId;
  } catch {
    return externalAccountId;
  }
}

function extractPostUrns(data: DmaFeedContentsResponse | null | undefined): string[] {
  if (!data?.elements) return [];
  const urns: string[] = [];
  for (const element of data.elements) {
    if (typeof element === "string") {
      urns.push(element);
      continue;
    }
    const record = element as Record<string, unknown>;
    const urn = (record.postUrn || record.urn || record.id) as string | undefined;
    if (urn) urns.push(urn);
  }
  return urns
    .map(normalizePostUrn)
    .filter((urn): urn is string => !!urn)
    .filter((urn) => urn.startsWith("urn:li:share:") || urn.startsWith("urn:li:ugcPost:"));
}

function normalizePostUrn(urn: string): string | null {
  const trimmed = urn.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("%")) return trimmed;
  try {
    const decoded = decodeURIComponent(trimmed);
    return decoded || trimmed;
  } catch {
    return trimmed;
  }
}

async function fetchPostUrns(
  headers: Record<string, string>,
  organizationId: string,
  maxCount: number
): Promise<string[]> {
  const authorUrn = `urn:li:organization:${organizationId}`;
  const urns: string[] = [];
  let cursor: string | undefined;

  while (urns.length < maxCount) {
    const remaining = maxCount - urns.length;
    const pageSize = Math.min(100, remaining);
    const feedUrl = `${API_URL}/dmaFeedContentsExternal` +
      `?author=${encodeURIComponent(authorUrn)}` +
      `&maxPaginationCount=${pageSize}` +
      `&q=postsByAuthor` +
      (cursor ? `&paginationCursor=${encodeURIComponent(cursor)}` : "");

    const response = await apiRequest<DmaFeedContentsResponse>(
      "linkedin",
      feedUrl,
      { headers },
      "dma_feed_contents"
    );

    const batch = extractPostUrns(response);
    if (batch.length) {
      urns.push(...batch);
    }

    cursor = response.metadata?.paginationCursorMetdata?.nextPaginationCursor;
    if (!cursor || batch.length === 0) {
      break;
    }
  }

  return Array.from(new Set(urns)).slice(0, maxCount);
}

async function fetchPostsByUrn(
  headers: Record<string, string>,
  urns: string[]
): Promise<Record<string, Record<string, unknown>>> {
  const results: Record<string, Record<string, unknown>> = {};
  const normalizedUrns = urns
    .map(normalizePostUrn)
    .filter((urn): urn is string => !!urn)
    .filter((urn) => urn.startsWith("urn:li:share:") || urn.startsWith("urn:li:ugcPost:"));
  if (!normalizedUrns.length) return results;
  const chunkSize = 20;

  for (let i = 0; i < normalizedUrns.length; i += chunkSize) {
    const chunk = normalizedUrns.slice(i, i + chunkSize);
    const idsParam = `List(${chunk.map((urn) => encodeRFC3986(urn)).join(",")})`;
    const postsUrl = `${API_URL}/dmaPosts?ids=${idsParam}&viewContext=READER`;

    const response = await apiRequest<DmaPostsResponse>(
      "linkedin",
      postsUrl,
      { headers },
      "dma_posts_batch"
    );

    Object.assign(results, response.results ?? {});
  }

  return results;
}

async function fetchPostTrendSeries(
  headers: Record<string, string>,
  postUrn: string,
  start: Date,
  end: Date
): Promise<{ totals: TrendCounts; perDate: Record<string, TrendCounts> }> {
  const response = await fetchTrendAnalytics(headers, postUrn, start, end, "dma_post_trend");
  const totals = createEmptyTrendCounts();
  const perDate: Record<string, TrendCounts> = {};

  for (const element of response.elements ?? []) {
    const count = parseCount(element.metric?.value);
    addTrendCount(totals, element.type, count);

    const startMs = element.metric?.timeIntervals?.timeRange?.start;
    if (!startMs) continue;
    const dateKey = new Date(startMs).toISOString().slice(0, 10);
    const bucket = perDate[dateKey] ?? createEmptyTrendCounts();
    addTrendCount(bucket, element.type, count);
    perDate[dateKey] = bucket;
  }

  return { totals, perDate };
}

/**
 * LinkedIn connector
 */
export const linkedinConnector: Connector = {
  platform: 'linkedin',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing LinkedIn access token');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };
    if (API_VERSION) {
      headers['LinkedIn-Version'] = API_VERSION;
    }

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    now.setUTCHours(23, 59, 59, 999);

    const dailyMap = new Map<string, DailyMetric>();
    const clicksMap = new Map<string, number>();
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
        views: 0,
      });
    }

    const pageId = await resolveOrganizationalPageId(headers, externalAccountId);
    const orgPageUrn = `urn:li:organizationalPage:${pageId}`;
    const followerDaily = await fetchFollowerTrend(headers, orgPageUrn, since, now);
    for (const [dateKey, count] of Object.entries(followerDaily)) {
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.followers = (entry.followers ?? 0) + count;
      }
    }

    const postUrns = await fetchPostUrns(headers, externalAccountId, MAX_POSTS_SYNC);
    const postData = postUrns.length ? await fetchPostsByUrn(headers, postUrns) : {};
    const posts: PostMetric[] = [];

    for (const postUrn of postUrns) {
      const post = postData[postUrn];
      if (!post) continue;

      const created = post.created as Record<string, unknown> | undefined;
      const publishedAt = post.publishedAt as number | undefined;
      const createdAt = (created?.time as number | undefined) ?? Date.now();
      const postedAt = new Date(publishedAt ?? createdAt).toISOString();

      const commentary = post.commentary as Record<string, unknown> | string | undefined;
      const caption = typeof commentary === "string"
        ? commentary
        : (commentary?.text as string | undefined);

      const trend = await fetchPostTrendSeries(headers, postUrn, since, now);
      const reach = trend.totals.uniqueImpressions || trend.totals.impressions;
      const engagements = trend.totals.reactions + trend.totals.comments + trend.totals.reposts + trend.totals.clicks;

      posts.push({
        external_post_id: postUrn,
        posted_at: postedAt,
        url: `https://www.linkedin.com/feed/update/${postUrn}`,
        caption: caption?.slice(0, 280) || "LinkedIn post",
        media_type: "ugc",
        metrics: {
          impressions: trend.totals.impressions,
          reach,
          engagements,
          likes: trend.totals.reactions,
          comments: trend.totals.comments,
          shares: trend.totals.reposts,
          clicks: trend.totals.clicks,
        },
        raw_json: post,
      });

      for (const [dateKey, counts] of Object.entries(trend.perDate)) {
        const entry = dailyMap.get(dateKey);
        if (!entry) continue;
        const dailyReach = counts.uniqueImpressions || counts.impressions;
        entry.impressions = (entry.impressions ?? 0) + counts.impressions;
        entry.reach = (entry.reach ?? 0) + dailyReach;
        entry.views = (entry.views ?? 0) + counts.impressions;
        entry.likes = (entry.likes ?? 0) + counts.reactions;
        entry.comments = (entry.comments ?? 0) + counts.comments;
        entry.shares = (entry.shares ?? 0) + counts.reposts;
        if (counts.clicks) {
          clicksMap.set(dateKey, (clicksMap.get(dateKey) ?? 0) + counts.clicks);
        }
      }

      const dateKey = postedAt.slice(0, 10);
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.posts_count = (entry.posts_count ?? 0) + 1;
      }
    }

    for (const [dateKey, entry] of dailyMap.entries()) {
      const clicks = clicksMap.get(dateKey) ?? 0;
      entry.engagements = (entry.likes ?? 0) + (entry.comments ?? 0) + (entry.shares ?? 0) + clicks;
    }

    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  },
};
