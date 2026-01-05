import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { META_CONFIG } from "@/lib/social-platforms/meta/config";
import type { DailyMetric, PostMetric } from "@/lib/social-platforms/core/types";

type MetaMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type MetaMediaResponse = {
  data?: MetaMediaItem[];
  paging?: { next?: string };
};

type MetaReachValue = { value: number; end_time?: string };
type MetaReachResponse = {
  data?: Array<{ name: string; period: string; values: MetaReachValue[] }>;
  paging?: { next?: string };
};

const GRAPH_URL = META_CONFIG.graphUrl;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function fetchInstagramReachSeries(params: {
  externalAccountId: string;
  accessToken: string;
  since: number;
  until: number;
}) {
  const { externalAccountId, accessToken, since, until } = params;
  const dailyReach = new Map<string, number>();
  const maxWindow = 30 * 24 * 60 * 60;
  let windowStart = since;

  while (windowStart <= until) {
    const windowEnd = Math.min(until, windowStart + maxWindow);
    let nextUrl: string | undefined = buildUrl(`${GRAPH_URL}/${externalAccountId}/insights`, {
      metric: "reach",
      period: "day",
      since: windowStart,
      until: windowEnd,
      access_token: accessToken
    });

    while (nextUrl) {
      const response: MetaReachResponse = await apiRequest("instagram", nextUrl, {}, "insights_reach_backfill");
      for (const metric of response.data ?? []) {
        for (const value of metric.values ?? []) {
          const date = value.end_time?.slice(0, 10);
          if (!date) continue;
          dailyReach.set(date, value.value ?? 0);
        }
      }
      nextUrl = response.paging?.next;
    }

    windowStart = windowEnd + 1;
  }

  return dailyReach;
}

export async function fetchInstagramTotalValueSnapshot(params: {
  externalAccountId: string;
  accessToken: string;
  since: number;
  until: number;
}) {
  const { externalAccountId, accessToken, since, until } = params;
  const totals: Record<string, number> = {};
  const maxWindow = 30 * 24 * 60 * 60;
  let windowStart = since;

  while (windowStart <= until) {
    const windowEnd = Math.min(until, windowStart + maxWindow);
    let nextUrl: string | undefined = buildUrl(`${GRAPH_URL}/${externalAccountId}/insights`, {
      metric: META_CONFIG.instagramTotalValueMetrics.join(","),
      period: "day",
      metric_type: "total_value",
      since: windowStart,
      until: windowEnd,
      access_token: accessToken
    });

    while (nextUrl) {
      const response: MetaReachResponse = await apiRequest(
        "instagram",
        nextUrl,
        {},
        "insights_total_backfill"
      );
      for (const metric of response.data ?? []) {
        const value = (metric as any).total_value?.value;
        if (typeof value === "number") {
          totals[metric.name] = value;
        }
      }
      nextUrl = response.paging?.next;
    }

    windowStart = windowEnd + 1;
  }

  return totals;
}

export async function fetchInstagramMediaBackfill(params: {
  externalAccountId: string;
  accessToken: string;
  sinceDate: Date;
  includeViews?: boolean;
}) {
  const { externalAccountId, accessToken, sinceDate, includeViews } = params;
  const debugViews = process.env.META_DEBUG_VIEWS === "1";
  let mediaChecked = 0;
  let mediaWithViews = 0;
  let viewsTotal = 0;
  let nextUrl: string | undefined = buildUrl(`${GRAPH_URL}/${externalAccountId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: 50,
    access_token: accessToken
  });
  const posts: PostMetric[] = [];

  const fetchMediaViews = async (mediaId: string, mediaType?: string) => {
    const normalized = (mediaType ?? "").toUpperCase();
    const metrics =
      normalized === "REEL"
        ? ["plays", "views", "video_views"]
        : normalized === "VIDEO"
          ? ["video_views", "views"]
          : [];
    if (!metrics.length) return 0;

    for (const metric of metrics) {
      try {
        const insightsUrl = buildUrl(`${GRAPH_URL}/${mediaId}/insights`, {
          metric,
          access_token: accessToken
        });
        const response = await apiRequest<{ data?: Array<{ values?: Array<{ value?: number }> }> }>(
          "instagram",
          insightsUrl,
          {},
          "media_views_backfill"
        );
        const value = response.data?.[0]?.values?.[0]?.value;
        if (typeof value === "number") {
          return value;
        }
      } catch (error) {
        if (debugViews) {
          console.warn("[meta-backfill] media views failed", {
            mediaId,
            mediaType: normalized,
            metric,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return 0;
  };

  while (nextUrl) {
    const response: MetaMediaResponse = await apiRequest("instagram", nextUrl, {}, "media_backfill");
    for (const item of response.data ?? []) {
      if (!item.timestamp) continue;
      const postDate = new Date(item.timestamp);
      if (postDate < sinceDate) {
        nextUrl = undefined;
        break;
      }
      mediaChecked += 1;
      const views = includeViews ? await fetchMediaViews(item.id, item.media_type) : 0;
      if (views > 0) {
        mediaWithViews += 1;
        viewsTotal += views;
      }
      posts.push({
        external_post_id: item.id,
        posted_at: item.timestamp,
        url: item.permalink,
        caption: item.caption?.slice(0, 500),
        media_type: item.media_type?.toLowerCase(),
        thumbnail_url: item.thumbnail_url || item.media_url,
        media_url: item.media_url,
        metrics: {
          likes: item.like_count ?? 0,
          comments: item.comments_count ?? 0,
          views
        },
        raw_json: item as unknown as Record<string, unknown>
      });
    }
    nextUrl = response.paging?.next;
  }

  if (debugViews) {
    console.info("[meta-backfill] views summary", {
      externalAccountId,
      mediaChecked,
      mediaWithViews,
      viewsTotal
    });
  }

  return posts;
}

export function buildInstagramDailyMetrics(params: {
  posts: PostMetric[];
  dailyReach: Map<string, number>;
  followers: number;
}) {
  const { posts, dailyReach, followers } = params;
  const dailyMap = new Map<string, DailyMetric>();

  for (const post of posts) {
    if (!post.posted_at) continue;
    const date = isoDate(new Date(post.posted_at));
    const entry = dailyMap.get(date) ?? { date };
    const views = post.metrics?.views ?? 0;
    entry.posts_count = (entry.posts_count ?? 0) + 1;
    entry.engagements =
      (entry.engagements ?? 0) +
      ((post.metrics?.likes ?? 0) + (post.metrics?.comments ?? 0) + (post.metrics?.shares ?? 0) + (post.metrics?.saves ?? 0));
    entry.views = (entry.views ?? 0) + views;
    entry.followers = followers;
    dailyMap.set(date, entry);
  }

  for (const [date, reach] of dailyReach.entries()) {
    const entry = dailyMap.get(date) ?? { date };
    entry.reach = reach;
    entry.followers = followers;
    if ((entry.impressions ?? 0) === 0 && reach > 0) {
      entry.impressions = reach;
    }
    if ((entry.views ?? 0) === 0 && reach > 0) {
      entry.views = entry.impressions ?? reach;
    }
    dailyMap.set(date, entry);
  }

  return Array.from(dailyMap.values()).map((entry) => {
    const reachValue = entry.reach ?? 0;
    const viewsValue = (entry.views ?? 0) > 0 ? entry.views ?? 0 : reachValue;
    return {
      date: entry.date,
      followers: entry.followers ?? followers,
      impressions: entry.impressions ?? 0,
      reach: reachValue,
      engagements: entry.engagements ?? 0,
      likes: entry.likes ?? 0,
      comments: entry.comments ?? 0,
      shares: entry.shares ?? 0,
      saves: entry.saves ?? 0,
      views: viewsValue,
      watch_time: entry.watch_time ?? 0,
      posts_count: entry.posts_count ?? 0,
      raw_json: entry.raw_json ?? null
    };
  });
}
