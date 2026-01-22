import { apiRequest, SocialApiError } from "@/lib/social-platforms/core/api-client";
import { LINKEDIN_CONFIG, getLinkedInVersion } from "@/lib/social-platforms/linkedin/config";
import type { DailyMetric, PostMetric } from "@/lib/social-platforms/core/types";

const API_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();
// Supported metrics per DMA doc: IMPRESSIONS, COMMENTS, REACTIONS, REPOSTS
const METRIC_TYPES = ["IMPRESSIONS", "COMMENTS", "REACTIONS", "REPOSTS"];
const MAX_POSTS = 50;

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

function parseCount(value?: DmaAnalyticsValue): number {
  if (!value) return 0;
  const total = value.totalCount?.long ?? (value.totalCount?.bigDecimal ? Number(value.totalCount.bigDecimal) : 0);
  const organic = value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.long ??
    (value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal
      ? Number(value.typeSpecificValue?.contentAnalyticsValue?.organicValue?.bigDecimal)
      : 0);
  return total || organic || 0;
}

function encodeRFC3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildTimeIntervalVariants(start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);
  const base = `timeRange:(start:${startMs},end:${endMs})`;
  const baseReversed = `timeRange:(end:${endMs},start:${startMs})`;
  const baseSeconds = `timeRange:(start:${startSec},end:${endSec})`;
  const baseSecondsReversed = `timeRange:(end:${endSec},start:${startSec})`;
  const variants = [
    { label: "timeIntervals_single", value: `(${base})` },
    { label: "timeIntervals_single_granularity", value: `(${base},timeGranularityType:DAY)` },
    { label: "timeIntervals_single_reversed", value: `(${baseReversed})` },
    { label: "timeIntervals_single_reversed_granularity", value: `(${baseReversed},timeGranularityType:DAY)` },
    { label: "timeIntervals_seconds", value: `(${baseSeconds})` },
    { label: "timeIntervals_seconds_granularity", value: `(${baseSeconds},timeGranularityType:DAY)` },
    { label: "timeIntervals_seconds_reversed", value: `(${baseSecondsReversed})` },
    { label: "timeIntervals_seconds_reversed_granularity", value: `(${baseSecondsReversed},timeGranularityType:DAY)` },
    { label: "timeIntervals_list", value: `List((${base}))` },
    { label: "timeIntervals_list_granularity", value: `List((${base},timeGranularityType:DAY))` },
    { label: "timeIntervals_list_reversed", value: `List((${baseReversed}))` },
    { label: "timeIntervals_list_reversed_granularity", value: `List((${baseReversed},timeGranularityType:DAY))` },
    { label: "timeIntervals_list_seconds", value: `List((${baseSeconds}))` },
    { label: "timeIntervals_list_seconds_granularity", value: `List((${baseSeconds},timeGranularityType:DAY))` },
    { label: "timeIntervals_list_seconds_reversed", value: `List((${baseSecondsReversed}))` },
    { label: "timeIntervals_list_seconds_reversed_granularity", value: `List((${baseSecondsReversed},timeGranularityType:DAY))` },
  ];

  const params = new URLSearchParams({
    "timeIntervals[0].timeRange.start": String(startMs),
    "timeIntervals[0].timeRange.end": String(endMs),
  });
  const paramsWithGranularity = new URLSearchParams({
    "timeIntervals[0].timeRange.start": String(startMs),
    "timeIntervals[0].timeRange.end": String(endMs),
    "timeIntervals[0].timeGranularityType": "DAY",
  });
  const paramsReversed = new URLSearchParams({
    "timeIntervals[0].timeRange.end": String(endMs),
    "timeIntervals[0].timeRange.start": String(startMs),
  });
  const paramsReversedGranularity = new URLSearchParams({
    "timeIntervals[0].timeRange.end": String(endMs),
    "timeIntervals[0].timeRange.start": String(startMs),
    "timeIntervals[0].timeGranularityType": "DAY",
  });
  const paramsSeconds = new URLSearchParams({
    "timeIntervals[0].timeRange.start": String(startSec),
    "timeIntervals[0].timeRange.end": String(endSec),
  });
  const paramsSecondsGranularity = new URLSearchParams({
    "timeIntervals[0].timeRange.start": String(startSec),
    "timeIntervals[0].timeRange.end": String(endSec),
    "timeIntervals[0].timeGranularityType": "DAY",
  });
  const paramsSecondsReversed = new URLSearchParams({
    "timeIntervals[0].timeRange.end": String(endSec),
    "timeIntervals[0].timeRange.start": String(startSec),
  });
  const paramsSecondsReversedGranularity = new URLSearchParams({
    "timeIntervals[0].timeRange.end": String(endSec),
    "timeIntervals[0].timeRange.start": String(startSec),
    "timeIntervals[0].timeGranularityType": "DAY",
  });

  return [
    ...variants,
    { label: "timeIntervals_bracket", value: params.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_granularity", value: paramsWithGranularity.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_reversed", value: paramsReversed.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_reversed_granularity", value: paramsReversedGranularity.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_seconds", value: paramsSeconds.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_seconds_granularity", value: paramsSecondsGranularity.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_seconds_reversed", value: paramsSecondsReversed.toString(), rawQuery: true },
    { label: "timeIntervals_bracket_seconds_reversed_granularity", value: paramsSecondsReversedGranularity.toString(), rawQuery: true },
    { label: "timeRange_param", value: `timeRange=(${base})`, rawQuery: true },
    { label: "timeRange_param_granularity", value: `timeRange=(${base},timeGranularityType:DAY)`, rawQuery: true },
    { label: "timeRange_param_seconds", value: `timeRange=(${baseSeconds})`, rawQuery: true },
    { label: "timeRange_param_seconds_granularity", value: `timeRange=(${baseSeconds},timeGranularityType:DAY)`, rawQuery: true },
    { label: "timeIntervals_encoded", value: `timeIntervals=${encodeRFC3986(`(${base})`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_granularity", value: `timeIntervals=${encodeRFC3986(`(${base},timeGranularityType:DAY)`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_reversed", value: `timeIntervals=${encodeRFC3986(`(${baseReversed})`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_reversed_granularity", value: `timeIntervals=${encodeRFC3986(`(${baseReversed},timeGranularityType:DAY)`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_seconds", value: `timeIntervals=${encodeRFC3986(`(${baseSeconds})`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_seconds_granularity", value: `timeIntervals=${encodeRFC3986(`(${baseSeconds},timeGranularityType:DAY)`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_seconds_reversed", value: `timeIntervals=${encodeRFC3986(`(${baseSecondsReversed})`)}`, rawQuery: true },
    { label: "timeIntervals_encoded_seconds_reversed_granularity", value: `timeIntervals=${encodeRFC3986(`(${baseSecondsReversed},timeGranularityType:DAY)`)}`, rawQuery: true },
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
  const metricsParam = `List(${METRIC_TYPES.join(",")})`;
  const timeIntervalsVariants = buildTimeIntervalVariants(start, end);
  let lastError: unknown = null;

  for (const variant of timeIntervalsVariants) {
    const baseQuery = `q=trend&sourceEntity=${encodeURIComponent(sourceEntity)}&metricTypes=${metricsParam}`;
    const timeQuery = (variant as { value: string; rawQuery?: boolean }).rawQuery
      ? (variant as { value: string }).value
      : `timeIntervals=${(variant as { value: string }).value}`;
    const trendUrl = `${API_URL}/dmaOrganizationalPageContentAnalytics?${baseQuery}&${timeQuery}`;
    try {
      return await apiRequest<DmaAnalyticsResponse>(
        "linkedin",
        trendUrl,
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

  throw lastError ?? new Error("LinkedIn DMA trend failed");
}

async function resolveOrganizationalPageId(
  headers: Record<string, string>,
  externalAccountId: string
): Promise<string> {
  const orgsUrl = `${API_URL}/dmaOrganizations?ids=List(${externalAccountId})`;
  try {
    const response = await apiRequest<{ results?: Record<string, Record<string, unknown>> }>(
      "linkedin",
      orgsUrl,
      { headers },
      "dma_org_lookup_backfill"
    );
    const result = response.results?.[externalAccountId];
    const pageUrn = result?.organizationalPage as string | undefined;
    const pageId = pageUrn?.replace("urn:li:organizationalPage:", "");
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
    "dma_feed_contents_backfill"
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
      "dma_posts_batch_backfill"
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
  const response = await fetchTrendAnalytics(
    headers,
    postUrn,
    start,
    end,
    "dma_post_trend_backfill"
  );

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

export async function fetchLinkedInDailyStats(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
}) {
  const { externalAccountId, accessToken } = params;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }

  const since = new Date(params.since);
  const until = new Date(params.until);
  since.setUTCHours(0, 0, 0, 0);
  until.setUTCHours(23, 59, 59, 999);

  const dailyMap = new Map<string, DailyMetric>();
  const clicksMap = new Map<string, number>();
  for (let d = new Date(since); d <= until; d.setDate(d.getDate() + 1)) {
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

  const pageId = await resolveOrganizationalPageId(headers, externalAccountId);
  const sourceEntity = `urn:li:organizationalPage:${pageId}`;
  const response = await fetchTrendAnalytics(
    headers,
    sourceEntity,
    since,
    until,
    "dma_page_trend_backfill"
  );

  for (const element of response.elements ?? []) {
    const startMs = element.metric?.timeIntervals?.timeRange?.start;
    const dateKey = startMs ? new Date(startMs).toISOString().slice(0, 10) : null;
    if (!dateKey) continue;
    const entry = dailyMap.get(dateKey) ?? { date: dateKey };
    const count = parseCount(element.metric?.value);

    switch (element.type) {
      case "IMPRESSIONS":
      case "UNIQUE_IMPRESSIONS":
        entry.impressions = (entry.impressions ?? 0) + count;
        entry.reach = (entry.reach ?? 0) + count;
        entry.views = (entry.views ?? 0) + count;
        break;
      case "COMMENTS":
        entry.comments = (entry.comments ?? 0) + count;
        break;
      case "REACTIONS":
        entry.likes = (entry.likes ?? 0) + count;
        break;
      case "REPOSTS":
        entry.shares = (entry.shares ?? 0) + count;
        break;
      case "CLICKS":
        clicksMap.set(dateKey, (clicksMap.get(dateKey) ?? 0) + count);
        break;
      default:
        break;
    }

    const clicks = clicksMap.get(dateKey) ?? 0;
    entry.engagements = (entry.likes ?? 0) + (entry.comments ?? 0) + (entry.shares ?? 0) + clicks;
    dailyMap.set(dateKey, entry);
  }

  const dailyMetrics = Array.from(dailyMap.values());
  dailyMetrics.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return dailyMetrics;
}

export async function fetchLinkedInPostsBackfill(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
}): Promise<PostMetric[]> {
  const { externalAccountId, accessToken, since } = params;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }

  const postUrns = await fetchPostUrns(headers, externalAccountId, MAX_POSTS);
  if (!postUrns.length) {
    return [];
  }

  const postData = await fetchPostsByUrn(headers, postUrns);
  const now = new Date();
  const posts: PostMetric[] = [];

  for (const postUrn of postUrns) {
    const post = postData[postUrn];
    if (!post) continue;

    const created = post.created as Record<string, unknown> | undefined;
    const publishedAt = post.publishedAt as number | undefined;
    const createdAt = (created?.time as number | undefined) ?? Date.now();
    const postedAt = new Date(publishedAt ?? createdAt).toISOString();

    if (new Date(postedAt) < since) {
      continue;
    }

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
      raw_json: post
    });
  }

  return posts;
}
