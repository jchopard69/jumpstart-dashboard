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

type DmaFeedContentsResponse = {
  elements?: Array<string | Record<string, unknown>>;
  paging?: Record<string, unknown>;
};

type DmaPostsResponse = {
  results?: Record<string, Record<string, unknown>>;
  statuses?: Record<string, number>;
};

// Supported metrics per DMA doc: IMPRESSIONS, COMMENTS, REACTIONS, REPOSTS
const METRIC_TYPES = ["IMPRESSIONS", "COMMENTS", "REACTIONS", "REPOSTS"];
const MAX_POSTS = 10;

function parseCount(value?: DmaAnalyticsValue): number {
  if (!value) return 0;
  const total = value.totalCount?.long ?? (value.totalCount?.bigDecimal ? Number(value.totalCount.bigDecimal) : 0);
  const organic = value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.long ??
    (value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal
      ? Number(value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal)
      : 0);
  return total || organic || 0;
}

function buildTimeIntervalVariants(start: Date, end: Date) {
  const base = `timeRange:(start:${start.getTime()},end:${end.getTime()})`;
  return [
    `(${base})`,
    `(${base},timeGranularityType:DAY)`,
    `List((${base}))`,
    `List((${base},timeGranularityType:DAY))`,
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
  const timeIntervalsVariants = buildTimeIntervalVariants(start, end);
  let lastError: unknown = null;

  for (const timeIntervals of timeIntervalsVariants) {
    const analyticsUrl = `${API_URL}/dmaOrganizationalPageContentAnalytics` +
      `?q=trend&sourceEntity=${encodeURIComponent(sourceEntity)}` +
      `&metricTypes=${metricsParam}` +
      `&timeIntervals=${timeIntervals}`;
    console.log('[linkedin] dma_page_trend url:', analyticsUrl);
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
  return urns.filter((urn) => urn.startsWith("urn:li:share:") || urn.startsWith("urn:li:ugcPost:"));
}

async function fetchPostUrns(
  headers: Record<string, string>,
  organizationId: string,
  maxCount: number
): Promise<string[]> {
  const authorUrn = `urn:li:organization:${organizationId}`;
  const feedUrl = `${API_URL}/dmaFeedContentsExternal` +
    `?author=${encodeURIComponent(authorUrn)}` +
    `&maxPaginationCount=${maxCount}` +
    `&q=postsByAuthor`;

  const response = await apiRequest<DmaFeedContentsResponse>(
    "linkedin",
    feedUrl,
    { headers },
    "dma_feed_contents"
  );

  return extractPostUrns(response);
}

async function fetchPostsByUrn(
  headers: Record<string, string>,
  urns: string[]
): Promise<Record<string, Record<string, unknown>>> {
  const results: Record<string, Record<string, unknown>> = {};
  const chunkSize = 20;

  for (let i = 0; i < urns.length; i += chunkSize) {
    const chunk = urns.slice(i, i + chunkSize);
    const idsParam = `List(${chunk.map((urn) => encodeURIComponent(urn)).join(",")})`;
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

async function fetchPostTrendMetrics(
  headers: Record<string, string>,
  postUrn: string,
  start: Date,
  end: Date
): Promise<Record<string, number>> {
  const response = await fetchTrendAnalytics(headers, postUrn, start, end, "dma_post_trend");

  const totals = {
    impressions: 0,
    comments: 0,
    reactions: 0,
    reposts: 0,
    clicks: 0,
  };

  for (const element of response.elements ?? []) {
    const count = parseCount(element.metric?.value);
    switch (element.type) {
      case "IMPRESSIONS":
      case "UNIQUE_IMPRESSIONS":
        totals.impressions += count;
        break;
      case "COMMENTS":
        totals.comments += count;
        break;
      case "REACTIONS":
        totals.reactions += count;
        break;
      case "REPOSTS":
        totals.reposts += count;
        break;
      case "CLICKS":
        totals.clicks += count;
        break;
      default:
        break;
    }
  }

  return totals;
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

    const pageId = await resolveOrganizationalPageId(headers, externalAccountId);
    const sourceEntity = `urn:li:organizationalPage:${pageId}`;
    const response = await fetchTrendAnalytics(headers, sourceEntity, since, now, 'dma_page_trend');

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

    for (const element of response.elements ?? []) {
      const startMs = element.metric?.timeIntervals?.timeRange?.start;
      const dateKey = startMs ? new Date(startMs).toISOString().slice(0, 10) : null;
      if (!dateKey) continue;
      const entry = dailyMap.get(dateKey) ?? { date: dateKey };
      const count = parseCount(element.metric?.value);

      switch (element.type) {
        case 'IMPRESSIONS':
        case 'UNIQUE_IMPRESSIONS':
          entry.impressions = (entry.impressions ?? 0) + count;
          entry.reach = (entry.reach ?? 0) + count;
          entry.views = (entry.views ?? 0) + count;
          break;
        case 'COMMENTS':
          entry.comments = (entry.comments ?? 0) + count;
          break;
        case 'REACTIONS':
          entry.likes = (entry.likes ?? 0) + count;
          break;
        case 'REPOSTS':
          entry.shares = (entry.shares ?? 0) + count;
          break;
        case 'CLICKS':
          clicksMap.set(dateKey, (clicksMap.get(dateKey) ?? 0) + count);
          break;
        default:
          break;
      }

      const clicks = clicksMap.get(dateKey) ?? 0;
      entry.engagements = (entry.likes ?? 0) + (entry.comments ?? 0) + (entry.shares ?? 0) + clicks;
      dailyMap.set(dateKey, entry);
    }

    const postUrns = await fetchPostUrns(headers, externalAccountId, MAX_POSTS);
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

      const metrics = await fetchPostTrendMetrics(headers, postUrn, since, now);

      posts.push({
        external_post_id: postUrn,
        posted_at: postedAt,
        url: `https://www.linkedin.com/feed/update/${postUrn}`,
        caption: caption?.slice(0, 280) || "LinkedIn post",
        media_type: "ugc",
        metrics: {
          impressions: metrics.impressions,
          likes: metrics.reactions,
          comments: metrics.comments,
          shares: metrics.reposts,
          clicks: metrics.clicks,
        },
        raw_json: post,
      });

      const dateKey = postedAt.slice(0, 10);
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.posts_count = (entry.posts_count ?? 0) + 1;
      }
    }

    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  },
};
