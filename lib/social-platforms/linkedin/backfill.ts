import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { LINKEDIN_CONFIG } from "@/lib/social-platforms/linkedin/config";
import type { DailyMetric, PostMetric } from "@/lib/social-platforms/core/types";

const API_URL = LINKEDIN_CONFIG.apiUrl;

type LinkedInFollowerStatsResponse = {
  elements?: Array<{
    timeRange?: { start?: number; end?: number };
    followerCounts?: {
      organicFollowerCount?: number;
      paidFollowerCount?: number;
    };
  }>;
};

type LinkedInShareStatsResponse = {
  elements?: Array<{
    timeRange?: { start?: number; end?: number };
    totalShareStatistics?: {
      shareCount?: number;
      likeCount?: number;
      commentCount?: number;
      impressionCount?: number;
      clickCount?: number;
    };
  }>;
};

type LinkedInPost = {
  id: string;
  created?: { time?: number };
  specificContent?: {
    "com.linkedin.ugc.ShareContent"?: {
      shareCommentary?: { text?: string };
      media?: Array<{ thumbnails?: Array<{ url?: string }> }>;
    };
  };
  socialDetail?: {
    totalShareStatistics?: {
      shareCount?: number;
      likeCount?: number;
      commentCount?: number;
      impressionCount?: number;
      clickCount?: number;
    };
  };
};

const buildTimeIntervalParams = (start: Date, end: Date) => ({
  "timeIntervals[0].timeRange.start": start.getTime(),
  "timeIntervals[0].timeRange.end": end.getTime(),
  "timeIntervals[0].timeGranularityType": "DAY"
});

const toDateKey = (timestampMs?: number) =>
  timestampMs ? new Date(timestampMs).toISOString().slice(0, 10) : null;

export async function fetchLinkedInDailyStats(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
}) {
  const { externalAccountId, accessToken } = params;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": "202401"
  };

  const since = new Date(params.since);
  const until = new Date(params.until);
  since.setUTCHours(0, 0, 0, 0);
  until.setUTCHours(23, 59, 59, 999);

  const dailyMap = new Map<string, DailyMetric>();
  for (let d = new Date(since); d <= until; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    dailyMap.set(date, {
      date,
      followers: 0,
      impressions: 0,
      reach: 0,
      engagements: 0,
      posts_count: 0
    });
  }

  const windowMs = 30 * 24 * 60 * 60 * 1000;
  let cursor = new Date(since);

  while (cursor <= until) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(Math.min(until.getTime(), windowStart.getTime() + windowMs - 1));
    windowStart.setUTCHours(0, 0, 0, 0);
    windowEnd.setUTCHours(23, 59, 59, 999);

    try {
      const followerUrl = buildUrl(
        `${API_URL}/organizationalEntityFollowerStatistics`,
        {
          q: "organizationalEntity",
          organizationalEntity: `urn:li:organization:${externalAccountId}`,
          ...buildTimeIntervalParams(windowStart, windowEnd)
        }
      );

      const followerStats = await apiRequest<LinkedInFollowerStatsResponse>(
        "linkedin",
        followerUrl,
        { headers },
        "linkedin_follower_backfill"
      );

      for (const element of followerStats.elements ?? []) {
        const date = toDateKey(element.timeRange?.start);
        if (!date) continue;
        const entry = dailyMap.get(date) ?? { date };
        const followers =
          (element.followerCounts?.organicFollowerCount ?? 0) +
          (element.followerCounts?.paidFollowerCount ?? 0);
        entry.followers = followers;
        dailyMap.set(date, entry);
      }
    } catch (error) {
      console.warn("[linkedin-backfill] follower stats failed", error);
    }

    try {
      const shareUrl = buildUrl(
        `${API_URL}/organizationalEntityShareStatistics`,
        {
          q: "organizationalEntity",
          organizationalEntity: `urn:li:organization:${externalAccountId}`,
          ...buildTimeIntervalParams(windowStart, windowEnd)
        }
      );

      const shareStats = await apiRequest<LinkedInShareStatsResponse>(
        "linkedin",
        shareUrl,
        { headers },
        "linkedin_share_backfill"
      );

      for (const element of shareStats.elements ?? []) {
        const date = toDateKey(element.timeRange?.start);
        if (!date) continue;
        const entry = dailyMap.get(date) ?? { date };
        const stats = element.totalShareStatistics ?? {};
        const likes = stats.likeCount ?? 0;
        const comments = stats.commentCount ?? 0;
        const shares = stats.shareCount ?? 0;
        const impressions = stats.impressionCount ?? 0;
        entry.impressions = impressions;
        entry.views = impressions;
        entry.engagements = likes + comments + shares;
        entry.likes = likes;
        entry.comments = comments;
        entry.shares = shares;
        dailyMap.set(date, entry);
      }
    } catch (error) {
      console.warn("[linkedin-backfill] share stats failed", error);
    }

    cursor = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
    cursor.setUTCHours(0, 0, 0, 0);
  }

  const dailyMetrics = Array.from(dailyMap.values());
  dailyMetrics.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return dailyMetrics;
}

export async function fetchLinkedInPostsBackfill(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
}) {
  const { externalAccountId, accessToken, since } = params;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": "202401"
  };

  const posts: PostMetric[] = [];
  let start = 0;
  const pageSize = 50;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_URL}/shares?` +
      new URLSearchParams({
        q: "owners",
        owners: `urn:li:organization:${externalAccountId}`,
        count: String(pageSize),
        sharesPerOwner: String(pageSize),
        start: String(start)
      }).toString();

    const response = await apiRequest<{ elements?: LinkedInPost[] }>(
      "linkedin",
      url,
      { headers },
      "linkedin_posts_backfill"
    );

    const elements = response.elements ?? [];
    if (!elements.length) {
      break;
    }

    for (const post of elements) {
      const postedAt = post.created?.time ? new Date(post.created.time) : new Date();
      if (postedAt < since) {
        hasMore = false;
        break;
      }

      const content = post.specificContent?.["com.linkedin.ugc.ShareContent"];
      const stats = post.socialDetail?.totalShareStatistics;
      posts.push({
        external_post_id: post.id,
        posted_at: postedAt.toISOString(),
        caption: content?.shareCommentary?.text?.slice(0, 500),
        media_type: content?.media?.[0] ? "image" : "text",
        thumbnail_url: content?.media?.[0]?.thumbnails?.[0]?.url,
        metrics: {
          shares: stats?.shareCount ?? 0,
          likes: stats?.likeCount ?? 0,
          comments: stats?.commentCount ?? 0,
          impressions: stats?.impressionCount ?? 0,
          clicks: stats?.clickCount ?? 0,
          views: stats?.impressionCount ?? 0
        },
        raw_json: post as unknown as Record<string, unknown>
      });
    }

    start += pageSize;
  }

  return posts;
}
