import { apiRequest, SocialApiError } from "@/lib/social-platforms/core/api-client";
import { LINKEDIN_CONFIG, getLinkedInVersion } from "@/lib/social-platforms/linkedin/config";
import type { DailyMetric, PostMetric } from "@/lib/social-platforms/core/types";

const API_REST_URL = LINKEDIN_CONFIG.apiUrl;
const API_V2_URL = LINKEDIN_CONFIG.apiV2Url ?? "https://api.linkedin.com/v2";
const API_VERSION = getLinkedInVersion();
const MAX_POSTS_BACKFILL = 200;

type ShareStats = {
  impressionCount?: number;
  uniqueImpressionsCount?: number;
  clickCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  engagement?: number;
};

type ShareStatsElement = {
  timeRange?: { start?: number; end?: number };
  totalShareStatistics?: ShareStats;
  share?: string;
};

type ShareStatsResponse = {
  elements?: ShareStatsElement[];
};

type FollowerStatsElement = {
  timeRange?: { start?: number; end?: number };
  followerGains?: {
    organicFollowerGain?: number;
    paidFollowerGain?: number;
  };
};

type FollowerStatsResponse = {
  elements?: FollowerStatsElement[];
};

type SharesResponse = {
  elements?: Array<Record<string, unknown>>;
};

type TrendCounts = {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
};

function createEmptyTrendCounts(): TrendCounts {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    clicks: 0,
    likes: 0,
    comments: 0,
    shares: 0
  };
}

function encodeRFC3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0"
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }
  return headers;
}

function normalizeOrganizationId(value: string): string {
  return value.replace("urn:li:organization:", "").replace("urn:li:organizationalPage:", "");
}

function buildTimeIntervalQueries(start: Date, end: Date, granularity?: "DAY") {
  const startMs = start.getTime();
  const endMs = end.getTime();

  const dotNotation = granularity
    ? `timeIntervals.timeGranularityType=${granularity}&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`
    : `timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;

  const tupleFormat = `(timeRange:(start:${startMs},end:${endMs})${granularity ? `,timeGranularityType:${granularity}` : ""})`;

  return [
    { label: "timeIntervals_dot", query: dotNotation },
    { label: "timeIntervals_encoded", query: `timeIntervals=${encodeRFC3986(tupleFormat)}` },
    { label: "timeIntervals_raw", query: `timeIntervals=${tupleFormat}` }
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

async function fetchFollowerGains(
  headers: Record<string, string>,
  organizationUrn: string,
  start: Date,
  end: Date
): Promise<Record<string, number>> {
  const timeIntervalsVariants = [
    ...buildTimeIntervalQueries(start, end, "DAY"),
    ...buildTimeIntervalQueries(start, end)
  ];
  let lastError: unknown = null;

  for (const variant of timeIntervalsVariants) {
    const baseQuery = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}`;
    const url = `${API_REST_URL}/organizationalEntityFollowerStatistics?${baseQuery}&${variant.query}`;

    try {
      const response = await apiRequest<FollowerStatsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_follower_stats_backfill"
      );
      const daily: Record<string, number> = {};
      for (const element of response.elements ?? []) {
        const startMs = element.timeRange?.start;
        if (!startMs) continue;
        const dateKey = new Date(startMs).toISOString().slice(0, 10);
        const organic = element.followerGains?.organicFollowerGain ?? 0;
        const paid = element.followerGains?.paidFollowerGain ?? 0;
        daily[dateKey] = (daily[dateKey] ?? 0) + organic + paid;
      }
      return daily;
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("LinkedIn follower stats failed");
}

function parseShareStats(element: ShareStatsElement): TrendCounts {
  const stats = element.totalShareStatistics ?? {};
  return {
    impressions: stats.impressionCount ?? 0,
    uniqueImpressions: stats.uniqueImpressionsCount ?? 0,
    clicks: stats.clickCount ?? 0,
    likes: stats.likeCount ?? 0,
    comments: stats.commentCount ?? 0,
    shares: stats.shareCount ?? 0
  };
}

async function fetchShareStats(
  headers: Record<string, string>,
  organizationUrn: string,
  start: Date,
  end: Date,
  shares?: string[]
): Promise<ShareStatsResponse> {
  // LinkedIn share stats are limited to a rolling 12-month window.
  const minStartMs = end.getTime() - 365 * 24 * 60 * 60 * 1000;
  const clampedStart = new Date(Math.max(start.getTime(), minStartMs));
  const timeIntervalsVariants = [
    ...buildTimeIntervalQueries(clampedStart, end, "DAY"),
    ...buildTimeIntervalQueries(clampedStart, end)
  ];
  let lastError: unknown = null;

  for (const variant of timeIntervalsVariants) {
    const baseQuery = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}`;
    const sharesParam = shares?.length
      ? `&shares=${encodeRFC3986(`List(${shares.join(",")})`)}`
      : "";
    const url = `${API_REST_URL}/organizationalEntityShareStatistics?${baseQuery}${sharesParam}&${variant.query}`;

    try {
      return await apiRequest<ShareStatsResponse>(
        "linkedin",
        url,
        { headers },
        shares?.length ? "linkedin_share_stats_by_share_backfill" : "linkedin_share_stats_backfill"
      );
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("LinkedIn share stats failed");
}

async function fetchOrganizationShares(
  headers: Record<string, string>,
  organizationUrn: string,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const pageSize = Math.min(100, limit);
  const url = `${API_V2_URL}/shares?q=owners&owners=${encodeURIComponent(organizationUrn)}` +
    `&sharesPerOwner=${pageSize}&count=${pageSize}` +
    `&projection=(elements*(id,created,commentary,text,content,specificContent),paging)`;

  const response = await apiRequest<SharesResponse>("linkedin", url, { headers }, "linkedin_shares_backfill");
  return (response.elements ?? []).slice(0, limit);
}

function extractShareText(share: Record<string, unknown>): string | undefined {
  const commentary = share.commentary as Record<string, unknown> | undefined;
  const commentaryText = commentary?.text as string | undefined;
  const text = share.text as Record<string, unknown> | string | undefined;
  if (typeof text === "string") return text;
  if (typeof text === "object" && text) {
    const textText = (text as Record<string, unknown>).text as string | undefined;
    if (textText) return textText;
  }
  return commentaryText;
}

function shareUrnFromId(id: unknown): string | null {
  if (!id) return null;
  if (typeof id === "string" && id.startsWith("urn:li:share:")) return id;
  return `urn:li:share:${id}`;
}

async function fetchShareStatsByShare(
  headers: Record<string, string>,
  organizationUrn: string,
  shareUrns: string[],
  start: Date,
  end: Date
): Promise<Record<string, TrendCounts>> {
  const statsByShare: Record<string, TrendCounts> = {};
  const chunkSize = 20;

  for (let i = 0; i < shareUrns.length; i += chunkSize) {
    const chunk = shareUrns.slice(i, i + chunkSize);
    try {
      const response = await fetchShareStats(headers, organizationUrn, start, end, chunk);
      for (const element of response.elements ?? []) {
        const shareUrn = element.share;
        if (!shareUrn) continue;
        const counts = parseShareStats(element);
        const existing = statsByShare[shareUrn] ?? createEmptyTrendCounts();
        existing.impressions += counts.impressions;
        existing.uniqueImpressions += counts.uniqueImpressions;
        existing.clicks += counts.clicks;
        existing.likes += counts.likes;
        existing.comments += counts.comments;
        existing.shares += counts.shares;
        statsByShare[shareUrn] = existing;
      }
    } catch (error) {
      console.warn("[linkedin] Failed to fetch share stats by share:", error);
    }
  }

  return statsByShare;
}

export async function fetchLinkedInDailyStats(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
}) {
  const headers = buildHeaders(params.accessToken);

  const since = new Date(params.since);
  const until = new Date(params.until);
  since.setUTCHours(0, 0, 0, 0);
  until.setUTCHours(23, 59, 59, 999);

  const dailyMap = new Map<string, DailyMetric>();
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

  const organizationId = normalizeOrganizationId(params.externalAccountId);
  const organizationUrn = `urn:li:organization:${organizationId}`;

  const followerDaily = await fetchFollowerGains(headers, organizationUrn, since, until);
  for (const [dateKey, count] of Object.entries(followerDaily)) {
    const entry = dailyMap.get(dateKey);
    if (entry) {
      entry.followers = (entry.followers ?? 0) + count;
    }
  }

  const shareStats = await fetchShareStats(headers, organizationUrn, since, until);
  for (const element of shareStats.elements ?? []) {
    const startMs = element.timeRange?.start;
    if (!startMs) continue;
    const dateKey = new Date(startMs).toISOString().slice(0, 10);
    const entry = dailyMap.get(dateKey);
    if (!entry) continue;
    const counts = parseShareStats(element);
    entry.impressions = (entry.impressions ?? 0) + counts.impressions;
    entry.reach = (entry.reach ?? 0) + counts.uniqueImpressions;
    entry.likes = (entry.likes ?? 0) + counts.likes;
    entry.comments = (entry.comments ?? 0) + counts.comments;
    entry.shares = (entry.shares ?? 0) + counts.shares;
    entry.engagements = (entry.engagements ?? 0) + counts.likes + counts.comments + counts.shares + counts.clicks;
    entry.views = (entry.views ?? 0) + counts.impressions;
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
  const headers = buildHeaders(params.accessToken);
  const organizationId = normalizeOrganizationId(params.externalAccountId);
  const organizationUrn = `urn:li:organization:${organizationId}`;

  const shares = await fetchOrganizationShares(headers, organizationUrn, MAX_POSTS_BACKFILL);
  if (!shares.length) {
    return [];
  }

  const now = new Date();
  const shareUrns = shares
    .map((share) => shareUrnFromId(share.id))
    .filter((urn): urn is string => !!urn);

  const shareStatsByShare = shareUrns.length
    ? await fetchShareStatsByShare(headers, organizationUrn, shareUrns, params.since, now)
    : {};

  const posts: PostMetric[] = [];

  for (const share of shares) {
    const shareUrn = shareUrnFromId(share.id);
    if (!shareUrn) continue;

    const created = share.created as Record<string, unknown> | undefined;
    const createdAt = (created?.time as number | undefined) ?? Date.now();
    const postedAt = new Date(createdAt).toISOString();

    if (new Date(postedAt) < params.since) {
      continue;
    }

    const caption = extractShareText(share);
    const counts = shareStatsByShare[shareUrn] ?? createEmptyTrendCounts();
    const engagements = counts.likes + counts.comments + counts.shares + counts.clicks;

    posts.push({
      external_post_id: shareUrn,
      posted_at: postedAt,
      url: `https://www.linkedin.com/feed/update/${shareUrn}`,
      caption: caption?.slice(0, 280) || "LinkedIn post",
      media_type: "share",
      metrics: {
        impressions: counts.impressions,
        reach: counts.uniqueImpressions,
        engagements,
        likes: counts.likes,
        comments: counts.comments,
        shares: counts.shares,
        clicks: counts.clicks
      },
      raw_json: share
    });
  }

  return posts;
}
