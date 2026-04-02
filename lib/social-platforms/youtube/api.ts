/**
 * YouTube Data API v3 + Analytics API client for fetching period metrics.
 */

import { getYouTubeConfig } from "./config";
import { apiRequest, buildUrl } from "../core/api-client";
import type { Connector, ConnectorSyncResult } from "@/lib/connectors/types";
import type { DailyMetric, PostMetric } from "../core/types";

const MAX_SYNC_DAYS = 30;
const SEARCH_PAGE_SIZE = 50;
const MAX_RECENT_VIDEOS = 100;
const VIDEO_BATCH_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics: {
    subscriberCount: string;
    viewCount: string;
    videoCount: string;
  };
}

interface YouTubeChannelResponse {
  items?: YouTubeChannel[];
}

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

interface YouTubeSearchItem {
  id?: {
    videoId?: string;
  };
  snippet?: {
    publishedAt?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface YouTubeVideosResponse {
  items?: YouTubeVideo[];
}

interface YouTubeAnalyticsResponse {
  columnHeaders?: Array<{
    name?: string;
  }>;
  rows?: Array<Array<string | number>>;
}

type YouTubeAnalyticsRow = Record<string, string | number>;

type VideoAnalytics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  estimatedMinutesWatched: number;
};

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function seedDailyMetrics(since: Date, until: Date): Map<string, DailyMetric> {
  const daily = new Map<string, DailyMetric>();

  for (let cursor = since.getTime(); cursor <= until.getTime(); cursor += DAY_MS) {
    const dateKey = new Date(cursor).toISOString().slice(0, 10);
    daily.set(dateKey, {
      date: dateKey,
      views: 0,
      engagements: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      watch_time: 0,
      posts_count: 0,
      raw_json: {
        youtube_subscriber_delta: 0,
      },
    });
  }

  return daily;
}

function mapAnalyticsRows(response: YouTubeAnalyticsResponse): YouTubeAnalyticsRow[] {
  const headers = (response.columnHeaders ?? []).map((header) => String(header.name ?? ""));
  return (response.rows ?? []).map((row) => {
    const mapped: YouTubeAnalyticsRow = {};
    headers.forEach((header, index) => {
      mapped[header] = row[index];
    });
    return mapped;
  });
}

function buildYouTubeFollowerSeries(
  metrics: DailyMetric[],
  currentSubscriberCount: number
): DailyMetric[] {
  const sorted = [...metrics].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  if (!sorted.length) {
    return sorted;
  }

  let runningTotal = currentSubscriberCount;
  sorted[sorted.length - 1].followers = runningTotal;

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const nextMetric = sorted[index + 1];
    const nextRaw = (nextMetric.raw_json as Record<string, unknown> | null | undefined) ?? {};
    const nextDelta = parseNumber(nextRaw.youtube_subscriber_delta);
    runningTotal = Math.max(0, runningTotal - nextDelta);
    sorted[index].followers = runningTotal;
  }

  return sorted;
}

function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function createApiContext(accessToken?: string | null) {
  const config = getYouTubeConfig();
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const buildDataUrl = (endpoint: string, params: Record<string, string | number | undefined>) => {
    const url = buildUrl(`${config.apiUrl}/${endpoint}`, params);
    if (!accessToken && config.apiKey) {
      return `${url}&key=${config.apiKey}`;
    }
    return url;
  };

  const buildAnalyticsUrl = (params: Record<string, string | number | undefined>) =>
    buildUrl(`${config.analyticsApiUrl}/reports`, params);

  return {
    config,
    headers,
    hasAnalytics: Boolean(accessToken),
    buildDataUrl,
    buildAnalyticsUrl,
  };
}

async function fetchChannel(
  buildDataUrl: (endpoint: string, params: Record<string, string | number | undefined>) => string,
  headers: Record<string, string>,
  channelId: string
): Promise<YouTubeChannel> {
  const channelUrl = buildDataUrl("channels", {
    part: "statistics,snippet",
    id: channelId,
  });

  const channelResponse = await apiRequest<YouTubeChannelResponse>(
    "youtube",
    channelUrl,
    { headers },
    "youtube_channels"
  );

  const channel = channelResponse.items?.[0];
  if (!channel) {
    throw new Error("Channel not found");
  }

  return channel;
}

async function fetchDailyAnalytics(
  buildAnalyticsUrl: (params: Record<string, string | number | undefined>) => string,
  headers: Record<string, string>,
  channelId: string,
  since: Date,
  until: Date
): Promise<YouTubeAnalyticsRow[]> {
  const analyticsUrl = buildAnalyticsUrl({
    ids: `channel==${channelId}`,
    startDate: toIsoDate(since),
    endDate: toIsoDate(until),
    metrics:
      "views,likes,comments,shares,subscribersGained,subscribersLost,estimatedMinutesWatched",
    dimensions: "day",
    sort: "day",
  });

  const response = await apiRequest<YouTubeAnalyticsResponse>(
    "youtube",
    analyticsUrl,
    { headers },
    "youtube_analytics_daily"
  );

  return mapAnalyticsRows(response);
}

async function fetchRecentVideoRefs(
  buildDataUrl: (endpoint: string, params: Record<string, string | number | undefined>) => string,
  headers: Record<string, string>,
  channelId: string,
  since: Date,
  until: Date
): Promise<Array<{ id: string; publishedAt: string }>> {
  const videos: Array<{ id: string; publishedAt: string }> = [];
  let nextPageToken: string | undefined;

  do {
    const searchUrl = buildDataUrl("search", {
      part: "id,snippet",
      channelId,
      order: "date",
      maxResults: SEARCH_PAGE_SIZE,
      type: "video",
      publishedAfter: since.toISOString(),
      publishedBefore: until.toISOString(),
      pageToken: nextPageToken,
    });

    const searchResponse = await apiRequest<YouTubeSearchResponse>(
      "youtube",
      searchUrl,
      { headers },
      "youtube_search_recent_videos"
    );

    for (const item of searchResponse.items ?? []) {
      const videoId = item.id?.videoId;
      const publishedAt = item.snippet?.publishedAt;
      if (videoId && publishedAt) {
        videos.push({ id: videoId, publishedAt });
      }
    }

    nextPageToken = searchResponse.nextPageToken;
  } while (nextPageToken && videos.length < MAX_RECENT_VIDEOS);

  return videos.slice(0, MAX_RECENT_VIDEOS);
}

async function fetchVideoDetails(
  buildDataUrl: (endpoint: string, params: Record<string, string | number | undefined>) => string,
  headers: Record<string, string>,
  videoIds: string[]
): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = [];

  for (let index = 0; index < videoIds.length; index += VIDEO_BATCH_SIZE) {
    const chunk = videoIds.slice(index, index + VIDEO_BATCH_SIZE);
    const videosUrl = buildDataUrl("videos", {
      part: "snippet,statistics",
      id: chunk.join(","),
    });

    const response = await apiRequest<YouTubeVideosResponse>(
      "youtube",
      videosUrl,
      { headers },
      "youtube_videos"
    );

    videos.push(...(response.items ?? []));
  }

  return videos;
}

async function fetchVideoAnalytics(
  buildAnalyticsUrl: (params: Record<string, string | number | undefined>) => string,
  headers: Record<string, string>,
  channelId: string,
  videoIds: string[],
  since: Date,
  until: Date
): Promise<Record<string, VideoAnalytics>> {
  const analyticsByVideo: Record<string, VideoAnalytics> = {};

  for (let index = 0; index < videoIds.length; index += VIDEO_BATCH_SIZE) {
    const chunk = videoIds.slice(index, index + VIDEO_BATCH_SIZE);
    const analyticsUrl = buildAnalyticsUrl({
      ids: `channel==${channelId}`,
      startDate: toIsoDate(since),
      endDate: toIsoDate(until),
      metrics: "views,likes,comments,shares,estimatedMinutesWatched",
      dimensions: "video",
      filters: `video==${chunk.join(",")}`,
    });

    const response = await apiRequest<YouTubeAnalyticsResponse>(
      "youtube",
      analyticsUrl,
      { headers },
      "youtube_analytics_videos"
    );

    for (const row of mapAnalyticsRows(response)) {
      const videoId = String(row.video ?? "");
      if (!videoId) continue;

      analyticsByVideo[videoId] = {
        views: parseNumber(row.views),
        likes: parseNumber(row.likes),
        comments: parseNumber(row.comments),
        shares: parseNumber(row.shares),
        estimatedMinutesWatched: parseNumber(row.estimatedMinutesWatched),
      };
    }
  }

  return analyticsByVideo;
}

export const youtubeConnector: Connector = {
  platform: "youtube",

  async sync({ externalAccountId, accessToken }): Promise<ConnectorSyncResult> {
    const { headers, hasAnalytics, buildDataUrl, buildAnalyticsUrl } = createApiContext(accessToken);
    const until = endOfDay(new Date());
    const since = startOfDay(new Date(until.getTime() - (MAX_SYNC_DAYS - 1) * DAY_MS));

    const channel = await fetchChannel(buildDataUrl, headers, externalAccountId);
    const currentSubscriberCount = parseNumber(channel.statistics.subscriberCount);

    const dailyMap = seedDailyMetrics(since, until);

    if (hasAnalytics) {
      try {
        const analyticsRows = await fetchDailyAnalytics(
          buildAnalyticsUrl,
          headers,
          externalAccountId,
          since,
          until
        );

        for (const row of analyticsRows) {
          const dateKey = String(row.day ?? "");
          const entry = dailyMap.get(dateKey);
          if (!entry) continue;

          const likes = parseNumber(row.likes);
          const comments = parseNumber(row.comments);
          const shares = parseNumber(row.shares);
          const views = parseNumber(row.views);
          const subscribersDelta =
            parseNumber(row.subscribersGained) - parseNumber(row.subscribersLost);

          entry.views = views;
          entry.likes = likes;
          entry.comments = comments;
          entry.shares = shares;
          entry.engagements = likes + comments + shares;
          entry.watch_time = parseNumber(row.estimatedMinutesWatched);
          entry.raw_json = {
            ...(entry.raw_json ?? {}),
            youtube_subscriber_delta: subscribersDelta,
          };
        }
      } catch (error) {
        console.warn("[youtube] Failed to fetch daily analytics, falling back to limited sync:", error);
      }
    }

    const recentVideoRefs = await fetchRecentVideoRefs(
      buildDataUrl,
      headers,
      externalAccountId,
      since,
      until
    );
    const recentVideoIds = Array.from(new Set(recentVideoRefs.map((video) => video.id)));
    const videos = recentVideoIds.length
      ? await fetchVideoDetails(buildDataUrl, headers, recentVideoIds)
      : [];

    const videoAnalytics: Record<string, VideoAnalytics> =
      hasAnalytics && recentVideoIds.length > 0
        ? await fetchVideoAnalytics(
            buildAnalyticsUrl,
            headers,
            externalAccountId,
            recentVideoIds,
            since,
            until
          ).catch((error) => {
            console.warn("[youtube] Failed to fetch per-video analytics, using data API stats fallback:", error);
            return {} as Record<string, VideoAnalytics>;
          })
        : {};

    const posts: PostMetric[] = videos
      .filter((video) => {
        const publishedAt = new Date(video.snippet.publishedAt).getTime();
        return publishedAt >= since.getTime() && publishedAt <= until.getTime();
      })
      .map((video) => {
        const analytics = videoAnalytics[video.id];
        const views = analytics?.views ?? parseNumber(video.statistics.viewCount);
        const likes = analytics?.likes ?? parseNumber(video.statistics.likeCount);
        const comments = analytics?.comments ?? parseNumber(video.statistics.commentCount);
        const shares = analytics?.shares ?? 0;
        const engagements = likes + comments + shares;

        return {
          external_post_id: video.id,
          posted_at: video.snippet.publishedAt,
          url: buildVideoUrl(video.id),
          caption: video.snippet.title,
          media_type: "video",
          thumbnail_url:
            video.snippet.thumbnails?.medium?.url ||
            video.snippet.thumbnails?.high?.url ||
            video.snippet.thumbnails?.default?.url,
          media_url: buildVideoUrl(video.id),
          metrics: {
            views,
            likes,
            comments,
            shares,
            engagements,
            watch_time: analytics?.estimatedMinutesWatched ?? 0,
          },
          raw_json: video as unknown as Record<string, unknown>,
        };
      });

    for (const post of posts) {
      const dateKey = post.posted_at.slice(0, 10);
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.posts_count = (entry.posts_count ?? 0) + 1;
      }
    }

    const dailyMetrics = buildYouTubeFollowerSeries(
      [...dailyMap.values()].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
      currentSubscriberCount
    );

    return { dailyMetrics, posts };
  },
};
