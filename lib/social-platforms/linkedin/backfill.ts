/**
 * LinkedIn Pages Data Portability API (DMA) backfill
 *
 * Reuses the DMA helper functions from api.ts to provide historical
 * daily stats and posts for the backfill cron job.
 */

import type { DailyMetric, PostMetric } from "@/lib/social-platforms/core/types";
import {
  buildHeaders,
  normalizeOrganizationId,
  fetchFollowerTrend,
  fetchPageContentTrend,
  fetchDmaPosts,
  fetchPostDetails,
  fetchSocialMetadata,
  fetchPostAnalytics,
  detectLinkedInMediaType,
  toLinkedInIsoDate,
} from "./api";

const MAX_POSTS_BACKFILL = 200;

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
      views: 0,
    });
  }

  const organizationId = normalizeOrganizationId(params.externalAccountId);

  // Fetch follower trend (daily gains)
  try {
    const followerData = await fetchFollowerTrend(headers, organizationId, since, until);
    for (const [dateKey, count] of Object.entries(followerData.daily)) {
      const entry = dailyMap.get(dateKey);
      if (entry) {
        entry.followers = (entry.followers ?? 0) + count;
      }
    }
  } catch (error) {
    console.log("[linkedin-backfill] Failed to fetch follower trend:", error instanceof Error ? error.message : error);
  }

  // Fetch page-level content analytics (daily impressions, reactions, etc.)
  try {
    const contentTrend = await fetchPageContentTrend(headers, organizationId, since, until);
    for (const [dateKey, counts] of contentTrend) {
      const entry = dailyMap.get(dateKey);
      if (!entry) continue;
      entry.impressions = (entry.impressions ?? 0) + counts.impressions;
      entry.reach = (entry.reach ?? 0) + counts.uniqueImpressions;
      entry.likes = (entry.likes ?? 0) + counts.reactions;
      entry.comments = (entry.comments ?? 0) + counts.comments;
      entry.shares = (entry.shares ?? 0) + counts.reposts;
      entry.engagements =
        (entry.engagements ?? 0) + counts.reactions + counts.comments + counts.reposts + counts.clicks;
      entry.views = (entry.views ?? 0) + counts.impressions;
    }
  } catch (error) {
    console.log("[linkedin-backfill] Failed to fetch content trend:", error instanceof Error ? error.message : error);
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

  // Fetch post URNs via DMA feed contents
  let postUrns: string[] = [];
  try {
    postUrns = await fetchDmaPosts(headers, organizationId, MAX_POSTS_BACKFILL);
  } catch (error) {
    console.log("[linkedin-backfill] Failed to fetch posts list:", error instanceof Error ? error.message : error);
    return [];
  }

  if (!postUrns.length) {
    return [];
  }

  // Fetch details and analytics in parallel
  const metricsUrns = postUrns.slice(0, 15);
  const [postDetails, socialMetadataMap, postAnalyticsMap] = await Promise.all([
    fetchPostDetails(headers, postUrns),
    fetchSocialMetadata(headers, metricsUrns),
    fetchPostAnalytics(headers, metricsUrns, 15),
  ]);

  const posts: PostMetric[] = [];

  for (const urn of postUrns) {
    const detail = postDetails.get(urn);
    const social = socialMetadataMap.get(urn);
    const analytics = postAnalyticsMap.get(urn);

    const createdAt = detail?.publishedAt ?? detail?.created?.time ?? detail?.createdAt ?? Date.now();
    const postedAt = toLinkedInIsoDate(createdAt);

    // Skip posts before the since date
    if (new Date(postedAt) < params.since) {
      continue;
    }

    const caption = typeof detail?.commentary === "string" && detail.commentary.trim().length > 0
      ? detail.commentary.slice(0, 280)
      : "LinkedIn post";
    const reactions = analytics?.reactions ?? social?.reactions ?? 0;
    const comments = analytics?.comments ?? social?.comments ?? 0;
    const reposts = analytics?.reposts ?? social?.reposts ?? 0;
    const impressions = analytics?.impressions ?? 0;
    const uniqueImpressions = analytics?.uniqueImpressions ?? 0;
    const clicks = analytics?.clicks ?? 0;
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
      media_type: detectLinkedInMediaType(detail?.content as Record<string, unknown> | undefined),
      metrics,
      raw_json: (detail as Record<string, unknown>) ?? {},
    });
  }

  return posts;
}
