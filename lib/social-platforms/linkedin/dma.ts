import { apiRequest, SocialApiError } from "../core/api-client";
import type { DailyMetric, PostMetric } from "../core/types";
import type { DemographicEntry } from "../../demographics-queries";

import { LINKEDIN_CONFIG, getLinkedInVersion } from "./config";

const API_REST_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();
const DEFAULT_LOCALE = "(language:en,country:US)";
const DEFAULT_FUNCTION_LOCALE = "en_US";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_WINDOW_DAYS = 365;
const POSTS_BATCH_SIZE = 20;
const SOCIAL_METADATA_BATCH_SIZE = 50;
const CONTENT_METRIC_TYPES = [
  "IMPRESSIONS",
  "UNIQUE_IMPRESSIONS",
  "CLICKS",
  "COMMENTS",
  "REACTIONS",
  "REPOSTS",
] as const;

type CountValue =
  | number
  | string
  | {
      long?: number | string;
      bigDecimal?: number | string;
    };

type OrganizationAuthorizationBatchFindResponse = {
  elements?: Array<{
    elements?: Array<{
      organization?: string;
      status?: {
        approved?: Record<string, unknown>;
        denied?: Record<string, unknown>;
      };
    }>;
  }>;
};

type OrganizationAclsResponse = {
  elements?: Array<{
    key?: {
      organization?: string;
    };
  }>;
};

type DmaImage = {
  downloadUrl?: string;
};

type DmaOrganizationRecord = {
  id?: number;
  organizationalPage?: string;
  localizedName?: string;
  name?: {
    localized?: Record<string, string>;
  };
  vanityName?: string;
  logoV2?: {
    cropped?: DmaImage;
    original?: DmaImage;
  };
};

type DmaOrganizationsResponse = {
  results?: Record<string, DmaOrganizationRecord>;
};

type DmaPageProfileResponse = {
  elements?: Array<{
    entityUrn?: string;
    pageUrl?: string;
    localizedName?: string;
    logo?: {
      digitalmediaAsset?: DmaImage;
    };
  }>;
};

type DmaPageFollowsResponse = {
  paging?: {
    total?: number;
  };
  metadata?: {
    nextPaginationCursor?: string | null;
  };
  elements?: Array<{
    follower?: string;
    followee?: string;
    edgeType?: string;
  }>;
};

type DmaEdgeAnalyticsValue = {
  totalCount?: CountValue;
  typeSpecificValue?: {
    followerEdgeAnalyticsValue?: {
      organicValue?: number;
      sponsoredValue?: number;
    };
    visitorEdgeAnalyticsValue?: {
      uniqueCount?: number;
      desktopCount?: number;
      mobileCount?: number;
      desktopUniqueCount?: number;
      mobileUniqueCount?: number;
      desktopCtaClickCount?: number;
      mobileCtaClickCount?: number;
      guestDesktopCount?: number;
      guestMobileCount?: number;
    };
  };
};

type DmaFollowerTrendResponse = {
  elements?: Array<{
    timeIntervals?: {
      timeRange?: {
        start?: number;
        end?: number;
      };
    };
    value?: DmaEdgeAnalyticsValue;
  }>;
};

type DmaContentAnalyticsElement = {
  type?: string;
  metric?: {
    timeIntervals?: {
      timeRange?: {
        start?: number;
        end?: number;
      };
    };
    value?: {
      totalCount?: CountValue;
      typeSpecificValue?: {
        contentAnalyticsValue?: {
          organicValue?: CountValue;
          sponsoredValue?: CountValue;
        };
      };
    };
  };
};

type DmaContentAnalyticsResponse = {
  elements?: DmaContentAnalyticsElement[];
};

type DmaFeedContentResponse = {
  elements?: Array<{
    id?: string;
  }>;
  metadata?: {
    paginationCursorMetdata?: {
      nextPaginationCursor?: string | null;
    };
    paginationCursorMetadata?: {
      nextPaginationCursor?: string | null;
    };
  };
};

type DmaPostsResponse = {
  results?: Record<string, Record<string, unknown>>;
};

type DmaSocialMetadataRecord = {
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

type DmaSocialMetadataResponse = {
  results?: Record<string, DmaSocialMetadataRecord>;
};

type DmaDimensionAnalyticsResponse = {
  elements?: Array<{
    dimension?: {
      value?: {
        urn?: string;
        staffRangeCount?: string;
      };
    };
    value?: DmaEdgeAnalyticsValue;
  }>;
};

type LinkedInOrganizationContext = {
  organizationId: string;
  organizationUrn: string;
  pageUrn: string;
  name: string;
  logoUrl?: string;
  pageUrl?: string;
  vanityName?: string;
};

type TrendCounts = {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
};

type SocialCounts = {
  reactions: number;
  comments: number;
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

export function buildRestliList(values: string[]): string {
  return `List(${values.join(",")})`;
}

export function buildOrganizationAuthorizationActionsParam(
  actionType: string
): string {
  return `List((authorizationAction:(organizationAnalyticsAuthorizationAction:(actionType:${actionType}))))`;
}

export function buildOrganizationPageEntityParam(
  organizationUrn: string
): string {
  return `(organization:${encodeUrn(organizationUrn)})`;
}

export async function fetchLinkedInOrganizations(accessToken: string): Promise<
  Array<{
    organizationId: string;
    organizationUrn: string;
    pageUrn: string;
    name: string;
    logoUrl?: string;
    pageUrl?: string;
  }>
> {
  const headers = buildHeaders(accessToken);
  const actionTypes = [
    "FOLLOWER_ANALYTICS_READ",
    "VISITOR_ANALYTICS_READ",
    "UPDATE_ANALYTICS_READ",
  ] as const;

  const authorizedOrgUrns = new Set<string>();

  for (const actionType of actionTypes) {
    try {
      const organizations = await fetchAuthorizedOrganizationsByAction(
        headers,
        actionType
      );
      for (const organizationUrn of organizations) {
        authorizedOrgUrns.add(organizationUrn);
      }
    } catch (error) {
      console.warn(
        `[linkedin] Failed to resolve DMA authorizations for ${actionType}:`,
        error
      );
    }
  }

  if (authorizedOrgUrns.size === 0) {
    const fallbackOrganizations = await fetchOrganizationsViaAcls(headers);
    for (const organizationUrn of fallbackOrganizations) {
      authorizedOrgUrns.add(organizationUrn);
    }
  }

  if (authorizedOrgUrns.size === 0) {
    return [];
  }

  const contexts = await fetchOrganizationContexts(headers, [
    ...authorizedOrgUrns,
  ]);

  return contexts.map((context) => ({
    organizationId: context.organizationId,
    organizationUrn: context.organizationUrn,
    pageUrn: context.pageUrn,
    name: context.name,
    logoUrl: context.logoUrl,
    pageUrl: context.pageUrl,
  }));
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
  const includeViews = params.includeViews !== false;
  const dailyMap = seedDailyMap(since, until, includeViews);

  try {
    const followerTrend = await fetchFollowerTrendByDay(
      headers,
      context.pageUrn,
      since,
      until
    );
    for (const [dateKey, count] of Object.entries(followerTrend)) {
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.followers = (entry.followers ?? 0) + count;
      }
    }
  } catch (error) {
    console.warn("[linkedin] Failed to fetch DMA follower trend:", error);
  }

  if (includeViews) {
    try {
      const visitorTrend = await fetchVisitorTrendByDay(
        headers,
        context.pageUrn,
        since,
        until
      );
      for (const [dateKey, count] of Object.entries(visitorTrend)) {
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.views = (entry.views ?? 0) + count;
        }
      }
    } catch (error) {
      console.warn("[linkedin] Failed to fetch DMA visitor trend:", error);
    }
  }

  try {
    const contentTrend = await fetchContentTrendElements(
      headers,
      context.pageUrn,
      since,
      until,
      "linkedin_dma_page_content_trend"
    );
    applyContentTrendToDailyMap(dailyMap, contentTrend);
  } catch (error) {
    console.warn("[linkedin] Failed to fetch DMA page content trend:", error);
  }

  try {
    const totalFollowers = await fetchFollowerTotal(headers, context.pageUrn);
    const latestDate = [...dailyMap.keys()].sort().slice(-1)[0];
    if (latestDate && totalFollowers > 0) {
      const entry = dailyMap.get(latestDate);
      if (entry) {
        entry.followers = totalFollowers;
      }
    }
  } catch (error) {
    console.warn("[linkedin] Failed to fetch DMA follower total:", error);
  }

  const posts = await fetchLinkedInPosts({
    externalAccountId: params.externalAccountId,
    accessToken: params.accessToken,
    since,
    limit: params.postLimit,
    includeAnalytics: params.includePostAnalytics,
    context,
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

export async function fetchLinkedInPosts(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  limit: number;
  includeAnalytics: boolean;
  context?: LinkedInOrganizationContext;
}): Promise<PostMetric[]> {
  if (params.limit <= 0) {
    return [];
  }

  const headers = buildHeaders(params.accessToken);
  const context =
    params.context ?? (await fetchOrganizationContext(headers, params.externalAccountId));

  const postUrns = await fetchPostUrnsByAuthor(
    headers,
    context.organizationUrn,
    params.limit
  );
  if (postUrns.length === 0) {
    return [];
  }

  const postsByUrn = await fetchPostsByUrn(headers, postUrns);
  const socialMetadata = await fetchSocialMetadataByUrn(headers, postUrns);

  const posts: PostMetric[] = [];
  const now = new Date();

  for (const postUrn of postUrns) {
    const post = postsByUrn.get(postUrn);
    if (!post) continue;

    const postedAtMs = readPostTimestamp(post);
    const postedAt = new Date(postedAtMs).toISOString();
    if (new Date(postedAt) < params.since) {
      continue;
    }

    const socialCounts = readSocialCounts(socialMetadata.get(postUrn));
    let analyticsCounts = createEmptyTrendCounts();

    if (
      params.includeAnalytics &&
      now.getTime() - postedAtMs <= MAX_ANALYTICS_WINDOW_DAYS * DAY_MS
    ) {
      try {
        const contentTrend = await fetchContentTrendElements(
          headers,
          postUrn,
          new Date(postedAtMs),
          now,
          "linkedin_dma_post_content_trend"
        );
        analyticsCounts = sumContentTrend(contentTrend);
      } catch (error) {
        console.warn(`[linkedin] Failed to fetch DMA post analytics for ${postUrn}:`, error);
      }
    }

    const reactions = analyticsCounts.reactions || socialCounts.reactions;
    const comments = analyticsCounts.comments || socialCounts.comments;
    const shares = analyticsCounts.reposts;
    const clicks = analyticsCounts.clicks;
    const engagements = reactions + comments + shares + clicks;

    posts.push({
      external_post_id: postUrn,
      posted_at: postedAt,
      url: `https://www.linkedin.com/feed/update/${postUrn}`,
      caption: extractPostCaption(post)?.slice(0, 280) || "LinkedIn post",
      media_type: "post",
      metrics: {
        impressions: analyticsCounts.impressions,
        reach: analyticsCounts.uniqueImpressions,
        engagements,
        likes: reactions,
        comments,
        shares,
        clicks,
      },
      raw_json: post,
    });
  }

  return posts;
}

export async function fetchLinkedInDemographics(
  accessToken: string,
  organizationId: string
): Promise<DemographicEntry[]> {
  const headers = buildHeaders(accessToken);
  const context = await fetchOrganizationContext(headers, organizationId);
  const entries: DemographicEntry[] = [];

  const dimensions = [
    { apiType: "COUNTRY_GEO", dimension: "country" },
    { apiType: "JOB_FUNCTION", dimension: "function" },
    { apiType: "SENIORITY", dimension: "seniority" },
    { apiType: "INDUSTRY", dimension: "industry" },
  ] as const;

  for (const dimension of dimensions) {
    try {
      const url =
        `${API_REST_URL}/dmaOrganizationalPageEdgeAnalytics` +
        `?q=dimension&organizationalPage=${encodeURIComponent(context.pageUrn)}` +
        `&analyticsType=FOLLOWER&dimensionType=${dimension.apiType}`;

      const response = await apiRequest<DmaDimensionAnalyticsResponse>(
        "linkedin",
        url,
        { headers },
        `linkedin_dma_${dimension.dimension}_dimension`
      );

      const validRows = (response.elements ?? [])
        .map((element) => ({
          urn: element.dimension?.value?.urn,
          count: readFollowerCount(element.value),
        }))
        .filter((element) => element.count > 0);

      if (validRows.length === 0) {
        continue;
      }

      const total = validRows.reduce((sum, row) => sum + row.count, 0);
      const resolvedRows = await Promise.all(
        validRows.map(async (row) => ({
          value: await resolveDimensionValue(headers, row.urn, dimension.apiType),
          count: row.count,
        }))
      );

      for (const row of resolvedRows) {
        entries.push({
          dimension: dimension.dimension,
          value: row.value,
          percentage: Math.round((row.count / total) * 1000) / 10,
          count: row.count,
        });
      }
    } catch (error) {
      console.warn(
        `[linkedin] Failed to fetch DMA ${dimension.dimension} demographics:`,
        error
      );
    }
  }

  return entries.sort((a, b) => {
    if (a.dimension === b.dimension) {
      return b.percentage - a.percentage;
    }
    return a.dimension.localeCompare(b.dimension);
  });
}

async function fetchAuthorizedOrganizationsByAction(
  headers: Record<string, string>,
  actionType: string
): Promise<string[]> {
  const organizations = new Set<string>();
  let start = 0;
  const count = 100;

  while (true) {
    const authorizationActions =
      buildOrganizationAuthorizationActionsParam(actionType);
    const url =
      `${API_REST_URL}/dmaOrganizationAuthorizations` +
      `?bq=authorizationActionsAndImpersonator&authorizationActions=${authorizationActions}` +
      `&start=${start}&count=${count}`;

    const response = await apiRequest<OrganizationAuthorizationBatchFindResponse>(
      "linkedin",
      url,
      { headers },
      `linkedin_dma_authorizations_${actionType.toLowerCase()}`
    );

    const pageEntries = response.elements?.flatMap(
      (page) => page.elements ?? []
    ) ?? [];

    for (const entry of pageEntries) {
      if (entry.organization && entry.status?.approved) {
        organizations.add(entry.organization);
      }
    }

    if (pageEntries.length < count) {
      break;
    }

    start += count;
  }

  return [...organizations];
}

async function fetchOrganizationsViaAcls(
  headers: Record<string, string>
): Promise<string[]> {
  const organizations = new Set<string>();
  let start = 0;
  const count = 100;

  while (true) {
    const url =
      `${API_REST_URL}/dmaOrganizationAcls` +
      `?q=roleAssignee&scopeFilter=(enabled:false)` +
      `&role=(value:ADMINISTRATOR)` +
      `&state=(value:APPROVED)` +
      `&start=${start}&count=${count}`;

    const response = await apiRequest<OrganizationAclsResponse>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_org_acls"
    );

    const pageEntries = response.elements ?? [];
    for (const entry of pageEntries) {
      const organizationUrn = entry.key?.organization;
      if (organizationUrn) {
        organizations.add(organizationUrn);
      }
    }

    if (pageEntries.length < count) {
      break;
    }

    start += count;
  }

  return [...organizations];
}

async function fetchOrganizationContexts(
  headers: Record<string, string>,
  organizationUrns: string[]
): Promise<LinkedInOrganizationContext[]> {
  if (organizationUrns.length === 0) {
    return [];
  }

  const organizationIds = organizationUrns
    .map((organizationUrn) => extractUrnId(organizationUrn, "urn:li:organization:"))
    .filter((value): value is string => !!value);

  if (organizationIds.length === 0) {
    return [];
  }

  const idsParam = buildRestliList(organizationIds);
  const localeParam = DEFAULT_LOCALE;
  const url =
    `${API_REST_URL}/dmaOrganizations` +
    `?ids=${idsParam}&locale=${localeParam}`;

  const response = await apiRequest<DmaOrganizationsResponse>(
    "linkedin",
    url,
    { headers },
    "linkedin_dma_organizations"
  );

  const contexts = new Map<string, LinkedInOrganizationContext>();

  for (const organizationId of organizationIds) {
    const organization = response.results?.[organizationId];
    if (!organization) continue;

    const organizationUrn = `urn:li:organization:${organizationId}`;
    const context: LinkedInOrganizationContext = {
      organizationId,
      organizationUrn,
      pageUrn:
        organization.organizationalPage ||
        `urn:li:organizationalPage:${organizationId}`,
      name:
        getLocalizedName(organization) ||
        `LinkedIn organization ${organizationId}`,
      logoUrl:
        organization.logoV2?.cropped?.downloadUrl ||
        organization.logoV2?.original?.downloadUrl,
      vanityName: organization.vanityName,
    };

    contexts.set(organizationId, context);
  }

  await Promise.all(
    [...contexts.values()].map(async (context) => {
      try {
        const profile = await fetchPageProfile(headers, context.organizationUrn);
        if (profile.pageUrn) {
          context.pageUrn = profile.pageUrn;
        }
        if (profile.pageUrl) {
          context.pageUrl = profile.pageUrl;
        }
        if (!context.logoUrl && profile.logoUrl) {
          context.logoUrl = profile.logoUrl;
        }
        if (!context.name && profile.name) {
          context.name = profile.name;
        }
      } catch (error) {
        console.warn(
          `[linkedin] Failed to hydrate page profile for ${context.organizationUrn}:`,
          error
        );
      }
    })
  );

  return [...contexts.values()].filter((context) => !!context.pageUrn);
}

async function fetchOrganizationContext(
  headers: Record<string, string>,
  externalAccountId: string
): Promise<LinkedInOrganizationContext> {
  const organizationId = normalizeOrganizationId(externalAccountId);
  const contexts = await fetchOrganizationContexts(headers, [
    `urn:li:organization:${organizationId}`,
  ]);
  const context = contexts[0];

  if (!context) {
    throw new Error(`LinkedIn DMA organization not found for ${organizationId}`);
  }

  return context;
}

async function fetchPageProfile(
  headers: Record<string, string>,
  organizationUrn: string
): Promise<{
  pageUrn?: string;
  pageUrl?: string;
  logoUrl?: string;
  name?: string;
}> {
  const pageEntity = buildOrganizationPageEntityParam(organizationUrn);
  const locale = DEFAULT_LOCALE;
  const url =
    `${API_REST_URL}/dmaOrganizationalPageProfiles` +
    `?q=pageEntity&pageEntity=${pageEntity}&locale=${locale}`;

  const response = await apiRequest<DmaPageProfileResponse>(
    "linkedin",
    url,
    { headers },
    "linkedin_dma_page_profile"
  );

  const element = response.elements?.[0];
  return {
    pageUrn: element?.entityUrn,
    pageUrl: element?.pageUrl,
    logoUrl: element?.logo?.digitalmediaAsset?.downloadUrl,
    name: element?.localizedName,
  };
}

async function fetchFollowerTotal(
  headers: Record<string, string>,
  pageUrn: string
): Promise<number> {
  const url =
    `${API_REST_URL}/dmaOrganizationalPageFollows` +
    `?q=followee&followee=${encodeURIComponent(pageUrn)}` +
    `&edgeType=MEMBER_FOLLOWS_ORGANIZATIONAL_PAGE&maxPaginationCount=1000`;

  const response = await apiRequest<DmaPageFollowsResponse>(
    "linkedin",
    url,
    { headers },
    "linkedin_dma_follower_total"
  );

  const total = response.paging?.total ?? 0;
  const visibleFollowers = response.elements?.length ?? 0;
  return Math.max(total, visibleFollowers);
}

async function fetchFollowerTrendByDay(
  headers: Record<string, string>,
  pageUrn: string,
  since: Date,
  until: Date
): Promise<Record<string, number>> {
  const daily: Record<string, number> = {};
  const ranges = splitDateRange(since, until, MAX_ANALYTICS_WINDOW_DAYS);

  for (const range of ranges) {
    const response = await fetchTrendWithIntervals<DmaFollowerTrendResponse>(
      headers,
      `${API_REST_URL}/dmaOrganizationalPageEdgeAnalytics` +
        `?q=trend&organizationalPage=${encodeURIComponent(pageUrn)}` +
        `&analyticsType=FOLLOWER`,
      range.start,
      range.end,
      "linkedin_dma_follower_trend"
    );

    for (const element of response.elements ?? []) {
      const startMs = element.timeIntervals?.timeRange?.start;
      if (!startMs) continue;
      const dateKey = new Date(startMs).toISOString().slice(0, 10);
      daily[dateKey] = (daily[dateKey] ?? 0) + readFollowerCount(element.value);
    }
  }

  return daily;
}

async function fetchVisitorTrendByDay(
  headers: Record<string, string>,
  pageUrn: string,
  since: Date,
  until: Date
): Promise<Record<string, number>> {
  const daily: Record<string, number> = {};
  const ranges = splitDateRange(since, until, MAX_ANALYTICS_WINDOW_DAYS);

  for (const range of ranges) {
    const response = await fetchTrendWithIntervals<DmaFollowerTrendResponse>(
      headers,
      `${API_REST_URL}/dmaOrganizationalPageEdgeAnalytics` +
        `?q=trend&organizationalPage=${encodeURIComponent(pageUrn)}` +
        `&analyticsType=VISITOR`,
      range.start,
      range.end,
      "linkedin_dma_visitor_trend"
    );

    for (const element of response.elements ?? []) {
      const startMs = element.timeIntervals?.timeRange?.start;
      if (!startMs) continue;
      const dateKey = new Date(startMs).toISOString().slice(0, 10);
      daily[dateKey] = (daily[dateKey] ?? 0) + readVisitorCount(element.value);
    }
  }

  return daily;
}

async function fetchContentTrendElements(
  headers: Record<string, string>,
  sourceEntityUrn: string,
  since: Date,
  until: Date,
  endpoint: string
): Promise<DmaContentAnalyticsElement[]> {
  const elements: DmaContentAnalyticsElement[] = [];
  const metricTypes = buildRestliList([...CONTENT_METRIC_TYPES]);
  const ranges = splitDateRange(since, until, MAX_ANALYTICS_WINDOW_DAYS);

  for (const range of ranges) {
    const response = await fetchTrendWithIntervals<DmaContentAnalyticsResponse>(
      headers,
      `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
        `?q=trend&sourceEntity=${encodeURIComponent(sourceEntityUrn)}` +
        `&metricTypes=${metricTypes}`,
      range.start,
      range.end,
      endpoint
    );
    elements.push(...(response.elements ?? []));
  }

  return elements;
}

async function fetchTrendWithIntervals<T extends { elements?: unknown[] }>(
  headers: Record<string, string>,
  baseUrl: string,
  since: Date,
  until: Date,
  endpoint: string
): Promise<T> {
  const variants = buildTimeIntervalVariants(since, until);
  let lastError: unknown = null;

  for (const variant of variants) {
    try {
      return await apiRequest<T>(
        "linkedin",
        `${baseUrl}&${variant}`,
        { headers },
        endpoint
      );
    } catch (error) {
      lastError = error;
      if (!isTimeIntervalsError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("LinkedIn DMA timeIntervals query failed");
}

async function fetchPostUrnsByAuthor(
  headers: Record<string, string>,
  organizationUrn: string,
  limit: number
): Promise<string[]> {
  const urns: string[] = [];
  let paginationCursor: string | null | undefined;
  const pageSize = Math.min(limit, 100);

  const encodedOrganizationUrn = encodeUrn(organizationUrn);
  const authorVariants = [
    encodedOrganizationUrn,
    buildRestliList([encodedOrganizationUrn]),
  ];
  let variantIndex = 0;

  while (urns.length < limit) {
    const author = authorVariants[variantIndex];
    const cursorParam = paginationCursor
      ? `&paginationCursor=${encodeURIComponent(paginationCursor)}`
      : "";
    const url =
      `${API_REST_URL}/dmaFeedContentsExternal` +
      `?author=${author}&maxPaginationCount=${Math.min(
        pageSize,
        limit - urns.length
      )}&q=postsByAuthor${cursorParam}`;

    try {
      const response = await apiRequest<DmaFeedContentResponse>(
        "linkedin",
        url,
        { headers },
        "linkedin_dma_posts_by_author"
      );

      const pageUrns =
        response.elements
          ?.map((element) => element.id)
          .filter((value): value is string => !!value) ?? [];

      urns.push(...pageUrns);

      paginationCursor =
        response.metadata?.paginationCursorMetadata?.nextPaginationCursor ??
        response.metadata?.paginationCursorMetdata?.nextPaginationCursor;

      if (!paginationCursor || pageUrns.length === 0) {
        break;
      }
    } catch (error) {
      if (variantIndex === 0 && urns.length === 0) {
        variantIndex = 1;
        continue;
      }
      throw error;
    }
  }

  return urns.slice(0, limit);
}

async function fetchPostsByUrn(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const posts = new Map<string, Record<string, unknown>>();

  for (let index = 0; index < postUrns.length; index += POSTS_BATCH_SIZE) {
    const batch = postUrns.slice(index, index + POSTS_BATCH_SIZE);
    const ids = buildRestliList(batch.map((urn) => encodeUrn(urn)));
    const url =
      `${API_REST_URL}/dmaPosts` +
      `?ids=${ids}&viewContext=READER`;

    const response = await apiRequest<DmaPostsResponse>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_posts_batch"
    );

    for (const [urn, post] of Object.entries(response.results ?? {})) {
      posts.set(urn, post);
    }
  }

  return posts;
}

async function fetchSocialMetadataByUrn(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, DmaSocialMetadataRecord>> {
  const metadata = new Map<string, DmaSocialMetadataRecord>();

  for (
    let index = 0;
    index < postUrns.length;
    index += SOCIAL_METADATA_BATCH_SIZE
  ) {
    const batch = postUrns.slice(index, index + SOCIAL_METADATA_BATCH_SIZE);
    const ids = buildRestliList(batch.map((urn) => encodeUrn(urn)));
    const url = `${API_REST_URL}/dmaSocialMetadata?ids=${ids}`;

    const response = await apiRequest<DmaSocialMetadataResponse>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_social_metadata"
    );

    for (const [urn, value] of Object.entries(response.results ?? {})) {
      metadata.set(urn, value);
    }
  }

  return metadata;
}

function applyContentTrendToDailyMap(
  dailyMap: Map<string, DailyMetric>,
  elements: DmaContentAnalyticsElement[]
) {
  for (const element of elements) {
    const startMs = element.metric?.timeIntervals?.timeRange?.start;
    if (!startMs) continue;

    const dateKey = new Date(startMs).toISOString().slice(0, 10);
    const entry = dailyMap.get(dateKey);
    if (!entry) continue;

    const value = readContentCount(element.metric?.value);

    switch (element.type) {
      case "IMPRESSIONS":
        entry.impressions = (entry.impressions ?? 0) + value;
        break;
      case "UNIQUE_IMPRESSIONS":
        entry.reach = (entry.reach ?? 0) + value;
        break;
      case "CLICKS":
        entry.engagements = (entry.engagements ?? 0) + value;
        break;
      case "COMMENTS":
        entry.comments = (entry.comments ?? 0) + value;
        entry.engagements = (entry.engagements ?? 0) + value;
        break;
      case "REACTIONS":
        entry.likes = (entry.likes ?? 0) + value;
        entry.engagements = (entry.engagements ?? 0) + value;
        break;
      case "REPOSTS":
        entry.shares = (entry.shares ?? 0) + value;
        entry.engagements = (entry.engagements ?? 0) + value;
        break;
      default:
        break;
    }
  }
}

function sumContentTrend(elements: DmaContentAnalyticsElement[]): TrendCounts {
  const totals = createEmptyTrendCounts();

  for (const element of elements) {
    const value = readContentCount(element.metric?.value);
    switch (element.type) {
      case "IMPRESSIONS":
        totals.impressions += value;
        break;
      case "UNIQUE_IMPRESSIONS":
        totals.uniqueImpressions += value;
        break;
      case "CLICKS":
        totals.clicks += value;
        break;
      case "COMMENTS":
        totals.comments += value;
        break;
      case "REACTIONS":
        totals.reactions += value;
        break;
      case "REPOSTS":
        totals.reposts += value;
        break;
      default:
        break;
    }
  }

  return totals;
}

function readFollowerCount(
  value: DmaEdgeAnalyticsValue | undefined
): number {
  const totalCount = normalizeCount(value?.totalCount);
  if (totalCount > 0) {
    return totalCount;
  }

  const organic =
    value?.typeSpecificValue?.followerEdgeAnalyticsValue?.organicValue ?? 0;
  const sponsored =
    value?.typeSpecificValue?.followerEdgeAnalyticsValue?.sponsoredValue ?? 0;
  return organic + sponsored;
}

export function readVisitorCount(
  value: DmaEdgeAnalyticsValue | undefined
): number {
  const totalCount = normalizeCount(value?.totalCount);
  if (totalCount > 0) {
    return totalCount;
  }

  const visitorValue = value?.typeSpecificValue?.visitorEdgeAnalyticsValue;
  return (
    (visitorValue?.desktopCount ?? 0) +
    (visitorValue?.mobileCount ?? 0) +
    (visitorValue?.guestDesktopCount ?? 0) +
    (visitorValue?.guestMobileCount ?? 0)
  );
}

function readContentCount(
  value:
    | {
        totalCount?: CountValue;
        typeSpecificValue?: {
          contentAnalyticsValue?: {
            organicValue?: CountValue;
            sponsoredValue?: CountValue;
          };
        };
      }
    | undefined
): number {
  const totalCount = normalizeCount(value?.totalCount);
  if (totalCount > 0) {
    return totalCount;
  }

  const organic = normalizeCount(
    value?.typeSpecificValue?.contentAnalyticsValue?.organicValue
  );
  const sponsored = normalizeCount(
    value?.typeSpecificValue?.contentAnalyticsValue?.sponsoredValue
  );
  return organic + sponsored;
}

function readSocialCounts(
  metadata: DmaSocialMetadataRecord | undefined
): SocialCounts {
  const reactions = Object.values(metadata?.reactionSummaries ?? {}).reduce(
    (sum, summary) => sum + (summary.count ?? 0),
    0
  );
  const comments = metadata?.commentSummary?.count ?? 0;

  return { reactions, comments };
}

async function resolveDimensionValue(
  headers: Record<string, string>,
  urn: string | undefined,
  dimensionType: string
): Promise<string> {
  if (!urn) return "Unknown";

  const geoId = extractUrnId(urn, "urn:li:geo:");
  if (geoId) {
    const locale = DEFAULT_LOCALE;
    const url = `${API_REST_URL}/dmaGeo/${geoId}?locale=${locale}`;
    const response = await apiRequest<Record<string, unknown>>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_geo_lookup",
      true
    );
    const defaultLocalizedName = response.defaultLocalizedName as
      | { value?: string }
      | undefined;
    return defaultLocalizedName?.value || urn;
  }

  const functionId = extractUrnId(urn, "urn:li:function:");
  if (functionId) {
    const url = `${API_REST_URL}/dmaFunctions/${functionId}?locale=${DEFAULT_FUNCTION_LOCALE}`;
    const response = await apiRequest<Record<string, unknown>>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_function_lookup",
      true
    );
    return getLocalizedName(response) || urn;
  }

  const seniorityId = extractUrnId(urn, "urn:li:seniority:");
  if (seniorityId) {
    const locale = DEFAULT_LOCALE;
    const url =
      `${API_REST_URL}/dmaStandardizedSeniorities/${seniorityId}` +
      `?locale=${locale}`;
    const response = await apiRequest<Record<string, unknown>>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_seniority_lookup",
      true
    );
    return getLocalizedName(response) || urn;
  }

  const industryId = extractUrnId(urn, "urn:li:industry:");
  if (industryId) {
    const locale = DEFAULT_LOCALE;
    const url =
      `${API_REST_URL}/dmaIndustryTaxonomyVersions/DEFAULT/dmaIndustries/${industryId}` +
      `?locale=${locale}`;
    const response = await apiRequest<Record<string, unknown>>(
      "linkedin",
      url,
      { headers },
      "linkedin_dma_industry_lookup",
      true
    );
    return getLocalizedName(response) || urn;
  }

  if (dimensionType === "STAFF_COUNT_RANGE") {
    return humanizeEnumValue(urn);
  }

  return urn;
}

function extractPostCaption(post: Record<string, unknown>): string | undefined {
  const commentary = post.commentary as Record<string, unknown> | string | undefined;
  if (typeof commentary === "string") {
    return commentary;
  }
  if (typeof commentary?.text === "string") {
    return commentary.text;
  }
  return undefined;
}

function readPostTimestamp(post: Record<string, unknown>): number {
  const publishedAt = normalizeCount(post.publishedAt as CountValue | undefined);
  if (publishedAt > 0) {
    return publishedAt;
  }

  const created = post.created as Record<string, unknown> | undefined;
  const createdAt = normalizeCount(created?.time as CountValue | undefined);
  if (createdAt > 0) {
    return createdAt;
  }

  return Date.now();
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

function splitDateRange(
  since: Date,
  until: Date,
  maxDays: number
): Array<{ start: Date; end: Date }> {
  const ranges: Array<{ start: Date; end: Date }> = [];
  let cursor = since.getTime();
  const end = until.getTime();
  const maxWindowMs = maxDays * DAY_MS;

  while (cursor <= end) {
    const windowEnd = Math.min(end, cursor + maxWindowMs - 1);
    ranges.push({
      start: new Date(cursor),
      end: new Date(windowEnd),
    });
    cursor = windowEnd + 1;
  }

  return ranges;
}

function buildTimeIntervalVariants(since: Date, until: Date): string[] {
  const start = since.getTime();
  const end = until.getTime();
  const withDayGranularity = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
  const withoutGranularity = `(timeRange:(start:${start},end:${end}))`;

  return [
    `timeIntervals=${withDayGranularity}`,
    `timeIntervals=${withoutGranularity}`,
    `timeIntervals=${encodeRFC3986(withDayGranularity)}`,
    `timeIntervals=${encodeRFC3986(withoutGranularity)}`,
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
    inputErrors?.some((inputError) => {
      const input = inputError.input as Record<string, unknown> | undefined;
      const inputPath = input?.inputPath as Record<string, unknown> | undefined;
      return String(inputPath?.fieldPath ?? "").includes("timeIntervals");
    }) ?? false
  );
}

function getLocalizedName(value: Record<string, unknown>): string | undefined {
  const localizedName = value.localizedName;
  if (typeof localizedName === "string" && localizedName.trim()) {
    return localizedName;
  }

  const name = value.name as { localized?: Record<string, string> } | undefined;
  const localized = name?.localized;
  if (localized) {
    const firstLocalized = Object.values(localized).find(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
    );
    if (firstLocalized) {
      return firstLocalized;
    }
  }

  return undefined;
}

function extractUrnId(urn: string, prefix: string): string | null {
  if (!urn.startsWith(prefix)) {
    return null;
  }
  return urn.slice(prefix.length);
}

function normalizeCount(value: CountValue | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  }

  if (typeof value === "object") {
    const longValue = value.long;
    if (longValue !== undefined) {
      return normalizeCount(longValue);
    }
    const decimalValue = value.bigDecimal;
    if (decimalValue !== undefined) {
      return normalizeCount(decimalValue);
    }
  }

  return 0;
}

function createEmptyTrendCounts(): TrendCounts {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    clicks: 0,
    reactions: 0,
    comments: 0,
    reposts: 0,
  };
}

function encodeRFC3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeUrn(value: string): string {
  return encodeURIComponent(value);
}

function humanizeEnumValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date): Date {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
