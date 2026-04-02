import { apiRequest, SocialApiError } from "../core/api-client";
import type { DailyMetric, PostMetric } from "../core/types";
import type { DemographicEntry } from "../../demographics-queries";

import { LINKEDIN_CONFIG, getLinkedInVersion } from "./config";

const API_REST_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCALE = "(language:en,country:US)";
const MAX_POSTS_SYNC = 50;
const POSTS_PAGE_SIZE = 100;
const POST_STATS_BATCH_SIZE = 20;
const SOCIAL_METADATA_BATCH_SIZE = 50;
const LOOKUP_BATCH_SIZE = 50;

type OrganizationAclRecord = {
  organizationTarget?: string;
  organization?: string;
  key?: {
    organization?: string;
  };
};

type OrganizationAclsResponse = {
  elements?: OrganizationAclRecord[];
  paging?: {
    count?: number;
    start?: number;
    links?: Array<{
      href?: string;
    }>;
  };
};

type OrganizationRecord = {
  id?: number;
  vanityName?: string;
  localizedName?: string;
  localizedWebsite?: string;
  name?: {
    localized?: Record<string, string>;
  };
};

type OrganizationsResponse = {
  results?: Record<string, OrganizationRecord>;
};

type NetworkSizeResponse = {
  firstDegreeSize?: number;
};

type FollowerCount = {
  organicFollowerCount?: number;
  paidFollowerCount?: number;
};

type FollowerFacetRow = {
  geo?: string;
  function?: string;
  industry?: string;
  seniority?: string;
  followerCounts?: FollowerCount;
};

type FollowerStatsElement = {
  organizationalEntity?: string;
  timeRange?: {
    start?: number;
    end?: number;
  };
  followerGains?: {
    organicFollowerGain?: number;
    paidFollowerGain?: number;
  };
  followerCountsByGeoCountry?: FollowerFacetRow[];
  followerCountsByFunction?: FollowerFacetRow[];
  followerCountsByIndustry?: FollowerFacetRow[];
  followerCountsBySeniority?: FollowerFacetRow[];
};

type FollowerStatsResponse = {
  elements?: FollowerStatsElement[];
};

type ShareStats = {
  impressionCount?: number;
  uniqueImpressionsCount?: number;
  uniqueImpressionsCounts?: number;
  clickCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
};

type ShareStatsElement = {
  organizationalEntity?: string;
  share?: string;
  ugcPost?: string;
  timeRange?: {
    start?: number;
    end?: number;
  };
  totalShareStatistics?: ShareStats;
};

type ShareStatsResponse = {
  elements?: ShareStatsElement[];
};

type PostsResponse = {
  elements?: Array<Record<string, unknown>>;
  paging?: {
    count?: number;
    start?: number;
    total?: number;
    links?: Array<{
      href?: string;
    }>;
  };
};

type SocialMetadataRecord = {
  commentSummary?: {
    count?: number;
    topLevelCount?: number;
  };
  reactionSummaries?: Record<
    string,
    {
      count?: number;
    }
  >;
};

type SocialMetadataResponse = {
  results?: Record<string, SocialMetadataRecord>;
};

type TargetingEntityResponse = {
  elements?: Array<{
    urn?: string;
    name?: string;
  }>;
};

type LinkedInOrganizationContext = {
  organizationId: string;
  organizationUrn: string;
  name: string;
  pageUrl?: string;
  vanityName?: string;
};

type TrendCounts = {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
};

type SocialCounts = {
  reactions: number;
  comments: number;
};

type LinkedInFollowerSnapshotMeta = {
  linkedin_follower_gain?: number;
  linkedin_follower_total?: number;
};

export function buildHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }
  return headers;
}

export function normalizeOrganizationId(value: string): string {
  return value
    .replace("urn:li:organization:", "")
    .replace("urn:li:organizationalPage:", "");
}

function encodeRFC3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildRestliList(values: string[]): string {
  return `List(${values.join(",")})`;
}

function createEmptyTrendCounts(): TrendCounts {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    clicks: 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function seedDailyMap(
  since: Date,
  until: Date,
  includeViews: boolean
): Map<string, DailyMetric> {
  const dailyMap = new Map<string, DailyMetric>();

  for (let cursor = since.getTime(); cursor <= until.getTime(); cursor += DAY_MS) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    dailyMap.set(date, {
      date,
      impressions: 0,
      reach: 0,
      engagements: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      posts_count: 0,
      ...(includeViews ? { views: 0 } : {}),
    });
  }

  return dailyMap;
}

function getLocalizedName(record: OrganizationRecord): string {
  return (
    record.localizedName ??
    record.name?.localized?.en_US ??
    record.name?.localized?.fr_FR ??
    "LinkedIn Organization"
  );
}

function buildOrganizationPageUrl(vanityName?: string): string | undefined {
  return vanityName
    ? `https://www.linkedin.com/company/${vanityName}/`
    : undefined;
}

function buildFallbackOrganizationContext(
  organizationId: string
): LinkedInOrganizationContext {
  return {
    organizationId,
    organizationUrn: `urn:li:organization:${organizationId}`,
    name: `LinkedIn organization ${organizationId}`,
  };
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readFollowerSnapshotMeta(metric: DailyMetric): LinkedInFollowerSnapshotMeta {
  const raw = metric.raw_json as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return {
    linkedin_follower_gain: readNumber(raw.linkedin_follower_gain),
    linkedin_follower_total: readNumber(raw.linkedin_follower_total),
  };
}

export function normalizeLinkedInFollowerSeries(
  metrics: DailyMetric[],
  baseline: number
): DailyMetric[] {
  const sorted = [...metrics]
    .map((metric) => ({
      ...metric,
      raw_json: metric.raw_json ? { ...metric.raw_json } : metric.raw_json,
    }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  if (!sorted.length) {
    return sorted;
  }

  const lastEntry = sorted[sorted.length - 1];
  const lastMeta = readFollowerSnapshotMeta(lastEntry);
  let absoluteTotal = lastMeta.linkedin_follower_total ?? 0;
  const lastRecordedValue = lastEntry.followers ?? 0;
  const lastRecordedGain = lastMeta.linkedin_follower_gain ?? 0;
  const dailyGains = sorted.map((metric, index) =>
    index === sorted.length - 1
      ? Math.max(lastRecordedGain, 0)
      : Math.max(metric.followers ?? 0, 0)
  );
  const maxDailyGain = sorted.reduce((max, metric, index) => {
    const meta = readFollowerSnapshotMeta(metric);
    const gain =
      index === sorted.length - 1
        ? Math.max(metric.followers ?? 0, meta.linkedin_follower_gain ?? 0)
        : metric.followers ?? 0;
    return Math.max(max, gain);
  }, 0);

  if (
    absoluteTotal <= 0 &&
    lastRecordedValue > 1 &&
    (sorted.length === 1 || lastRecordedValue > maxDailyGain * 10)
  ) {
    absoluteTotal = lastRecordedValue;
  }

  if (absoluteTotal > 0 && baseline > 100 && absoluteTotal < baseline * 0.5) {
    console.warn(
      `[linkedin] Ignoring suspicious follower total ${absoluteTotal} because it is <50% of baseline ${baseline}.`
    );
    absoluteTotal = 0;
    if (lastRecordedGain > 0) {
      lastEntry.followers = lastRecordedGain;
    }
  }

  if (absoluteTotal > 0) {
    let runningTotal = Math.max(absoluteTotal, baseline);
    lastEntry.followers = runningTotal;

    let nextDayGain = dailyGains[sorted.length - 1] ?? 0;
    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      runningTotal = Math.max(0, runningTotal - nextDayGain);
      sorted[index].followers = runningTotal;
      nextDayGain = dailyGains[index] ?? 0;
    }

    return sorted;
  }

  let cumulative = baseline;
  for (const metric of sorted) {
    const delta = metric.followers ?? 0;
    cumulative += delta;
    metric.followers = cumulative;
  }

  if (sorted.length > 0 && (sorted[sorted.length - 1].followers ?? 0) < baseline && baseline > 0) {
    sorted[sorted.length - 1].followers = baseline;
  }

  return sorted;
}

function buildTimeIntervalQueries(
  start: Date,
  end: Date,
  granularity?: "DAY"
): string[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const dotNotation = granularity
    ? `timeIntervals.timeGranularityType=${granularity}&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`
    : `timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;
  const tupleFormat = `(timeRange:(start:${startMs},end:${endMs})${granularity ? `,timeGranularityType:${granularity}` : ""})`;

  return [
    dotNotation,
    `timeIntervals=${tupleFormat}`,
    `timeIntervals=${encodeRFC3986(tupleFormat)}`,
  ];
}

function isTimeIntervalsError(error: unknown): boolean {
  if (!(error instanceof SocialApiError)) return false;
  const raw = error.rawError as Record<string, unknown> | undefined;
  const message = String(raw?.message ?? error.message).toLowerCase();
  if (message.includes("timeinterval")) {
    return true;
  }
  const details = raw?.errorDetails as Record<string, unknown> | undefined;
  const inputErrors = details?.inputErrors as Array<Record<string, unknown>> | undefined;
  return (
    inputErrors?.some((item) => {
      const input = item.input as Record<string, unknown> | undefined;
      const inputPath = input?.inputPath as Record<string, unknown> | undefined;
      return String(inputPath?.fieldPath ?? "").includes("timeIntervals");
    }) ?? false
  );
}

async function fetchAdminOrganizationIds(
  headers: Record<string, string>
): Promise<string[]> {
  const organizationIds = new Set<string>();
  let start = 0;
  const count = 100;

  while (true) {
    const url =
      `${API_REST_URL}/organizationAcls?q=roleAssignee` +
      `&role=ADMINISTRATOR&state=APPROVED&start=${start}&count=${count}`;

    const response = await apiRequest<OrganizationAclsResponse>(
      "linkedin",
      url,
      { headers },
      "linkedin_organization_acls"
    );

    const elements = response.elements ?? [];
    for (const element of elements) {
      const organizationUrn =
        element.organizationTarget ??
        element.organization ??
        element.key?.organization;
      if (organizationUrn) {
        organizationIds.add(normalizeOrganizationId(organizationUrn));
      }
    }

    if (elements.length < count) {
      break;
    }

    start += count;
  }

  return [...organizationIds];
}

async function fetchOrganizationsByIds(
  headers: Record<string, string>,
  organizationIds: string[]
): Promise<LinkedInOrganizationContext[]> {
  const contexts: LinkedInOrganizationContext[] = [];

  for (let index = 0; index < organizationIds.length; index += 100) {
    const batch = organizationIds.slice(index, index + 100);
    const url =
      `${API_REST_URL}/organizations` +
      `?ids=${buildRestliList(batch)}`;

    let response: OrganizationsResponse;
    try {
      response = await apiRequest<OrganizationsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_organizations_batch"
      );
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 429) {
        console.warn(
          "[linkedin] organizations batch throttled; falling back to unresolved organization contexts",
          {
            batch,
          }
        );
        contexts.push(...batch.map((organizationId) => buildFallbackOrganizationContext(organizationId)));
        continue;
      }
      throw error;
    }

    for (const organizationId of batch) {
      const record = response.results?.[organizationId];
      if (!record) {
        continue;
      }

      contexts.push({
        organizationId,
        organizationUrn: `urn:li:organization:${organizationId}`,
        name: getLocalizedName(record),
        vanityName: record.vanityName,
        pageUrl: buildOrganizationPageUrl(record.vanityName),
      });
    }
  }

  return contexts;
}

async function fetchOrganizationContext(
  headers: Record<string, string>,
  externalAccountId: string
): Promise<LinkedInOrganizationContext> {
  const organizationId = normalizeOrganizationId(externalAccountId);
  const contexts = await fetchOrganizationsByIds(headers, [organizationId]);
  const context = contexts[0];

  if (!context) {
    return buildFallbackOrganizationContext(organizationId);
  }

  return context;
}

export async function fetchLinkedInOrganizations(
  accessToken: string
): Promise<
  Array<{
    organizationId: string;
    organizationUrn: string;
    name: string;
    pageUrl?: string;
  }>
> {
  const headers = buildHeaders(accessToken);
  const organizationIds = await fetchAdminOrganizationIds(headers);
  if (organizationIds.length === 0) {
    return [];
  }

  return fetchOrganizationsByIds(headers, organizationIds);
}

async function fetchNetworkSize(
  headers: Record<string, string>,
  organizationId: string
): Promise<number> {
  const organizationUrn = `urn:li:organization:${organizationId}`;
  const edgeTypes = [
    "COMPANY_FOLLOWED_BY_MEMBER",
    "CompanyFollowedByMember",
  ];

  for (const edgeType of edgeTypes) {
    const url =
      `${API_REST_URL}/networkSizes/${encodeURIComponent(organizationUrn)}` +
      `?edgeType=${edgeType}`;

    try {
      const response = await apiRequest<NetworkSizeResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_network_size"
      );

      if (typeof response.firstDegreeSize === "number") {
        return response.firstDegreeSize;
      }
    } catch (error) {
      if (edgeType === edgeTypes[edgeTypes.length - 1]) {
        throw error;
      }
    }
  }

  return 0;
}

async function fetchFollowerGains(
  headers: Record<string, string>,
  organizationUrn: string,
  since: Date,
  until: Date
): Promise<Record<string, number>> {
  const variants = buildTimeIntervalQueries(since, until, "DAY");
  let lastError: unknown = null;

  for (const variant of variants) {
    const url =
      `${API_REST_URL}/organizationalEntityFollowerStatistics` +
      `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}` +
      `&${variant}`;

    try {
      const response = await apiRequest<FollowerStatsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_follower_stats"
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

  throw lastError ?? new Error("LinkedIn follower statistics failed");
}

async function fetchLifetimeFollowerStats(
  headers: Record<string, string>,
  organizationUrn: string
): Promise<FollowerStatsElement | null> {
  const url =
    `${API_REST_URL}/organizationalEntityFollowerStatistics` +
    `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}`;

  const response = await apiRequest<FollowerStatsResponse>(
    "linkedin",
    url,
    { headers },
    "linkedin_follower_stats_lifetime"
  );

  return response.elements?.[0] ?? null;
}

function parseShareStats(element: ShareStatsElement): TrendCounts {
  const stats = element.totalShareStatistics ?? {};

  return {
    impressions: stats.impressionCount ?? 0,
    uniqueImpressions:
      stats.uniqueImpressionsCount ?? stats.uniqueImpressionsCounts ?? 0,
    clicks: stats.clickCount ?? 0,
    likes: stats.likeCount ?? 0,
    comments: stats.commentCount ?? 0,
    shares: stats.shareCount ?? 0,
  };
}

async function fetchTimeBoundShareStats(
  headers: Record<string, string>,
  organizationUrn: string,
  since: Date,
  until: Date
): Promise<ShareStatsResponse> {
  const maxRetentionStart = until.getTime() - 365 * DAY_MS;
  const clampedSince = new Date(Math.max(since.getTime(), maxRetentionStart));
  const variants = buildTimeIntervalQueries(clampedSince, until, "DAY");
  let lastError: unknown = null;

  for (const variant of variants) {
    const url =
      `${API_REST_URL}/organizationalEntityShareStatistics` +
      `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}` +
      `&${variant}`;

    try {
      return await apiRequest<ShareStatsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_share_stats"
      );
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("LinkedIn share statistics failed");
}

async function fetchShareStatsByPost(
  headers: Record<string, string>,
  organizationUrn: string,
  postUrns: string[]
): Promise<Record<string, TrendCounts>> {
  const statsByPost: Record<string, TrendCounts> = {};
  const shareUrns = postUrns.filter((urn) => urn.startsWith("urn:li:share:"));
  const ugcPostUrns = postUrns.filter((urn) => urn.startsWith("urn:li:ugcPost:"));

  for (let index = 0; index < shareUrns.length; index += POST_STATS_BATCH_SIZE) {
    const chunk = shareUrns.slice(index, index + POST_STATS_BATCH_SIZE);
    const url =
      `${API_REST_URL}/organizationalEntityShareStatistics` +
      `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}` +
      `&shares=${buildRestliList(chunk.map((urn) => encodeURIComponent(urn)))}`;

    try {
      const response = await apiRequest<ShareStatsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_share_stats_by_share"
      );

      for (const element of response.elements ?? []) {
        const urn = element.share;
        if (!urn) continue;
        statsByPost[urn] = parseShareStats(element);
      }
    } catch (error) {
      console.warn("[linkedin] Failed to fetch share statistics for share batch:", error);
    }
  }

  for (let index = 0; index < ugcPostUrns.length; index += POST_STATS_BATCH_SIZE) {
    const chunk = ugcPostUrns.slice(index, index + POST_STATS_BATCH_SIZE);
    const ugcParams = chunk
      .map((urn, chunkIndex) => `ugcPosts[${chunkIndex}]=${encodeURIComponent(urn)}`)
      .join("&");
    const url =
      `${API_REST_URL}/organizationalEntityShareStatistics` +
      `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}` +
      `&${ugcParams}`;

    try {
      const response = await apiRequest<ShareStatsResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_share_stats_by_ugc_post"
      );

      for (const element of response.elements ?? []) {
        const urn = element.ugcPost;
        if (!urn) continue;
        statsByPost[urn] = parseShareStats(element);
      }
    } catch (error) {
      console.warn("[linkedin] Failed to fetch share statistics for UGC batch:", error);
    }
  }

  return statsByPost;
}

async function fetchOrganizationPosts(
  headers: Record<string, string>,
  organizationUrn: string,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const posts: Array<Record<string, unknown>> = [];
  let start = 0;

  while (posts.length < limit) {
    const count = Math.min(POSTS_PAGE_SIZE, limit - posts.length);
    const url =
      `${API_REST_URL}/posts?q=author&author=${encodeURIComponent(organizationUrn)}` +
      `&viewContext=READER&sortBy=LAST_MODIFIED&start=${start}&count=${count}`;

    const response = await apiRequest<PostsResponse>(
      "linkedin",
      url,
      { headers },
      "linkedin_posts_by_author"
    );

    const elements = response.elements ?? [];
    posts.push(...elements);

    if (elements.length < count) {
      break;
    }

    start += elements.length;
  }

  return posts.slice(0, limit);
}

async function fetchSocialMetadataByPosts(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Record<string, SocialCounts>> {
  const countsByPost: Record<string, SocialCounts> = {};

  for (let index = 0; index < postUrns.length; index += SOCIAL_METADATA_BATCH_SIZE) {
    const chunk = postUrns.slice(index, index + SOCIAL_METADATA_BATCH_SIZE);
    const ids = buildRestliList(chunk.map((urn) => encodeURIComponent(urn)));
    const url = `${API_REST_URL}/socialMetadata?ids=${ids}`;

    try {
      const response = await apiRequest<SocialMetadataResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_social_metadata"
      );

      for (const [urn, metadata] of Object.entries(response.results ?? {})) {
        countsByPost[urn] = {
          reactions: Object.values(metadata.reactionSummaries ?? {}).reduce(
            (sum, item) => sum + (item.count ?? 0),
            0
          ),
          comments: metadata.commentSummary?.count ?? 0,
        };
      }
    } catch (error) {
      console.warn("[linkedin] Failed to fetch social metadata batch:", error);
    }
  }

  return countsByPost;
}

function readPostUrn(post: Record<string, unknown>): string | null {
  const id = post.id;
  return typeof id === "string" ? id : null;
}

function readPostTimestamp(post: Record<string, unknown>): number {
  const publishedAt = readNumber(post.publishedAt);
  if (publishedAt > 0) return publishedAt;

  const createdAt = readNumber(post.createdAt);
  if (createdAt > 0) return createdAt;

  const lastModifiedAt = readNumber(post.lastModifiedAt);
  if (lastModifiedAt > 0) return lastModifiedAt;

  return Date.now();
}

function extractPostText(post: Record<string, unknown>): string | undefined {
  const commentary = post.commentary;
  if (typeof commentary === "string") {
    return commentary;
  }
  if (
    typeof commentary === "object" &&
    commentary &&
    typeof (commentary as Record<string, unknown>).text === "string"
  ) {
    return (commentary as Record<string, unknown>).text as string;
  }

  const text = post.text;
  if (typeof text === "string") {
    return text;
  }
  if (
    typeof text === "object" &&
    text &&
    typeof (text as Record<string, unknown>).text === "string"
  ) {
    return (text as Record<string, unknown>).text as string;
  }

  return undefined;
}

function inferPostMediaType(post: Record<string, unknown>): string {
  if (post.reshareContext) return "reshare";

  const content = post.content as Record<string, unknown> | undefined;
  if (!content) return "text";

  if (content.article) return "article";
  if (content.multiImage) return "multi_image";
  if (content.carousel) return "carousel";
  if (content.poll) return "poll";
  if (content.event) return "event";

  const media = content.media as Record<string, unknown> | undefined;
  const mediaId = typeof media?.id === "string" ? media.id : undefined;
  if (mediaId?.startsWith("urn:li:video:")) return "video";
  if (mediaId?.startsWith("urn:li:image:")) return "image";
  if (mediaId?.startsWith("urn:li:document:")) return "document";
  if (mediaId) return "media";

  return "text";
}

function fallbackDimensionValue(urn: string | undefined): string {
  if (!urn) return "Unknown";
  return urn.split(":").pop() || urn;
}

async function resolveUrnLabels(
  headers: Record<string, string>,
  urns: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const uniqueUrns = [...new Set(urns.filter(Boolean))];

  for (let index = 0; index < uniqueUrns.length; index += LOOKUP_BATCH_SIZE) {
    const chunk = uniqueUrns.slice(index, index + LOOKUP_BATCH_SIZE);
    const url =
      `${API_REST_URL}/adTargetingEntities?q=urns&queryVersion=QUERY_USES_URNS` +
      `&urns=${buildRestliList(chunk.map((urn) => encodeURIComponent(urn)))}` +
      `&locale=${DEFAULT_LOCALE}`;

    try {
      const response = await apiRequest<TargetingEntityResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_targeting_urns"
      );

      for (const element of response.elements ?? []) {
        if (element.urn && element.name) {
          resolved.set(element.urn, element.name);
        }
      }
    } catch (error) {
      console.warn("[linkedin] Failed to resolve targeting URNs:", error);
    }
  }

  return resolved;
}

function mapFollowerFacetRows(
  rows: FollowerFacetRow[] | undefined,
  urnKey: "geo" | "function" | "industry" | "seniority"
): Array<{ urn: string; count: number }> {
  return (rows ?? [])
    .map((row) => ({
      urn: String(row[urnKey] ?? ""),
      count: row.followerCounts?.organicFollowerCount ?? 0,
    }))
    .filter((row) => row.urn && row.count > 0);
}

export async function fetchLinkedInDemographics(
  accessToken: string,
  organizationId: string
): Promise<DemographicEntry[]> {
  const headers = buildHeaders(accessToken);
  const context = await fetchOrganizationContext(headers, organizationId);
  const stats = await fetchLifetimeFollowerStats(headers, context.organizationUrn);

  if (!stats) {
    return [];
  }

  const entries: DemographicEntry[] = [];
  const dimensions = [
    {
      dimension: "country",
      rows: mapFollowerFacetRows(stats.followerCountsByGeoCountry, "geo"),
    },
    {
      dimension: "function",
      rows: mapFollowerFacetRows(stats.followerCountsByFunction, "function"),
    },
    {
      dimension: "seniority",
      rows: mapFollowerFacetRows(stats.followerCountsBySeniority, "seniority"),
    },
    {
      dimension: "industry",
      rows: mapFollowerFacetRows(stats.followerCountsByIndustry, "industry"),
    },
  ] as const;

  for (const dimension of dimensions) {
    if (dimension.rows.length === 0) {
      continue;
    }

    const total = dimension.rows.reduce((sum, row) => sum + row.count, 0);
    const labels = await resolveUrnLabels(
      headers,
      dimension.rows.map((row) => row.urn)
    );

    for (const row of dimension.rows) {
      entries.push({
        dimension: dimension.dimension,
        value: labels.get(row.urn) ?? fallbackDimensionValue(row.urn),
        percentage: Math.round((row.count / total) * 1000) / 10,
        count: row.count,
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.dimension === b.dimension) {
      return b.percentage - a.percentage;
    }
    return a.dimension.localeCompare(b.dimension);
  });
}

export async function fetchLinkedInPosts(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  limit: number;
  includeAnalytics: boolean;
}): Promise<PostMetric[]> {
  if (params.limit <= 0) {
    return [];
  }

  const headers = buildHeaders(params.accessToken);
  const context = await fetchOrganizationContext(headers, params.externalAccountId);
  const posts = await fetchOrganizationPosts(
    headers,
    context.organizationUrn,
    params.limit
  );

  const filteredPosts = posts.filter((post) => {
    const postedAt = readPostTimestamp(post);
    return postedAt >= params.since.getTime();
  });

  const postUrns = filteredPosts
    .map(readPostUrn)
    .filter((urn): urn is string => !!urn);

  const shareStatsByPost =
    params.includeAnalytics && postUrns.length > 0
      ? await fetchShareStatsByPost(headers, context.organizationUrn, postUrns)
      : {};

  const socialMetadataByPost =
    params.includeAnalytics && postUrns.length > 0
      ? await fetchSocialMetadataByPosts(headers, postUrns)
      : {};

  return filteredPosts.map((post) => {
    const postUrn = readPostUrn(post) ?? `urn:li:post:${readPostTimestamp(post)}`;
    const postedAt = new Date(readPostTimestamp(post)).toISOString();
    const caption = extractPostText(post);
    const shareStats = shareStatsByPost[postUrn] ?? createEmptyTrendCounts();
    const socialCounts = socialMetadataByPost[postUrn] ?? {
      reactions: 0,
      comments: 0,
    };
    const reactions = socialCounts.reactions || shareStats.likes;
    const comments = socialCounts.comments || shareStats.comments;
    const engagements =
      reactions + comments + shareStats.shares + shareStats.clicks;

    return {
      external_post_id: postUrn,
      posted_at: postedAt,
      url: `https://www.linkedin.com/feed/update/${postUrn}`,
      caption: caption?.slice(0, 280) || "LinkedIn post",
      media_type: inferPostMediaType(post),
      metrics: params.includeAnalytics
        ? {
            impressions: shareStats.impressions,
            reach: shareStats.uniqueImpressions,
            engagements,
            likes: reactions,
            comments,
            shares: shareStats.shares,
            clicks: shareStats.clicks,
          }
        : undefined,
      raw_json: post,
    };
  });
}

export async function fetchLinkedInDailyMetricsAndPosts(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
  postLimit: number;
  includePostAnalytics: boolean;
  includeViews?: boolean;
}): Promise<{ dailyMetrics: DailyMetric[]; posts: PostMetric[] }> {
  const headers = buildHeaders(params.accessToken);
  const context = await fetchOrganizationContext(headers, params.externalAccountId);
  const since = startOfDay(params.since);
  const until = endOfDay(params.until);
  const dailyMap = seedDailyMap(since, until, params.includeViews === true);

  try {
    const followerDaily = await fetchFollowerGains(
      headers,
      context.organizationUrn,
      since,
      until
    );

    for (const [dateKey, count] of Object.entries(followerDaily)) {
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.followers = (entry.followers ?? 0) + count;
      }
    }
  } catch (error) {
    console.warn("[linkedin] Failed to fetch follower gains:", error);
  }

  try {
    const shareStats = await fetchTimeBoundShareStats(
      headers,
      context.organizationUrn,
      since,
      until
    );

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
      entry.engagements =
        (entry.engagements ?? 0) +
        counts.likes +
        counts.comments +
        counts.shares +
        counts.clicks;
      if (typeof entry.views === "number") {
        entry.views += counts.impressions;
      }
    }
  } catch (error) {
    console.warn("[linkedin] Failed to fetch share statistics:", error);
  }

  try {
    const totalFollowers = await fetchNetworkSize(headers, context.organizationId);
    const latestDate = [...dailyMap.keys()].sort().slice(-1)[0];
    if (latestDate && totalFollowers > 0) {
      const entry = dailyMap.get(latestDate);
      if (entry) {
        const followerGain = entry.followers ?? 0;
        entry.raw_json = {
          ...(entry.raw_json ?? {}),
          linkedin_follower_gain: followerGain,
          linkedin_follower_total: totalFollowers,
        };
        entry.followers = totalFollowers;
      }
    }
  } catch (error) {
    console.warn("[linkedin] Failed to fetch follower total:", error);
  }

  const posts = await fetchLinkedInPosts({
    externalAccountId: params.externalAccountId,
    accessToken: params.accessToken,
    since,
    limit: params.postLimit,
    includeAnalytics: params.includePostAnalytics,
  });

  for (const post of posts) {
    const dateKey = post.posted_at.slice(0, 10);
    const entry = dailyMap.get(dateKey);
    if (entry) {
      entry.posts_count = (entry.posts_count ?? 0) + 1;
    }
  }

  const dailyMetrics = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { dailyMetrics, posts };
}

export async function fetchLinkedInDailyStatsRange(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
  includeViews?: boolean;
}): Promise<DailyMetric[]> {
  const result = await fetchLinkedInDailyMetricsAndPosts({
    ...params,
    postLimit: 0,
    includePostAnalytics: false,
  });

  return result.dailyMetrics;
}

export const LINKEDIN_COMMUNITY_MAX_POSTS_SYNC = MAX_POSTS_SYNC;
