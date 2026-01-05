/**
 * LinkedIn Marketing API client for fetching analytics
 */

import { LINKEDIN_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = LINKEDIN_CONFIG.apiUrl;

interface LinkedInFollowerStats {
  elements?: Array<{
    timeRange?: { start?: number; end?: number };
    followerCounts?: {
      organicFollowerCount?: number;
      paidFollowerCount?: number;
    };
  }>;
}

interface LinkedInShareStats {
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
}

interface LinkedInPost {
  id: string;
  created?: { time?: number };
  specificContent?: {
    'com.linkedin.ugc.ShareContent'?: {
      shareCommentary?: { text?: string };
      media?: Array<{
        thumbnails?: Array<{ url?: string }>;
      }>;
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

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'LinkedIn-Version': '202401',
    };

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    now.setUTCHours(23, 59, 59, 999);

    const buildTimeIntervals = (start: Date, end: Date) =>
      `List((timeRange:(start:${start.getTime()},end:${end.getTime()}),timeGranularityType:DAY))`;
    const buildTimeIntervalBracketParams = (start: Date, end: Date) => ({
      'timeIntervals[0].timeRange.start': start.getTime(),
      'timeIntervals[0].timeRange.end': end.getTime(),
      'timeIntervals[0].timeGranularityType': 'DAY',
    });
    const requestWithTimeIntervals = async <T>(baseUrl: string, endpoint: string) => {
      const listUrl = `${baseUrl}&timeIntervals=${encodeURIComponent(buildTimeIntervals(since, now))}`;
      try {
        return await apiRequest<T>('linkedin', listUrl, { headers }, endpoint);
      } catch (error) {
        if (error instanceof Error && error.message.includes('timeIntervals')) {
          const bracketParams = buildTimeIntervalBracketParams(since, now);
          const bracketUrl = `${baseUrl}&${new URLSearchParams({
            'timeIntervals[0].timeRange.start': String(bracketParams['timeIntervals[0].timeRange.start']),
            'timeIntervals[0].timeRange.end': String(bracketParams['timeIntervals[0].timeRange.end']),
            'timeIntervals[0].timeGranularityType': String(bracketParams['timeIntervals[0].timeGranularityType']),
          }).toString()}`;
          return await apiRequest<T>('linkedin', bracketUrl, { headers }, endpoint);
        }
        throw error;
      }
    };

    let followers = 0;
    let shareStatsLoaded = false;

    const dailyMap = new Map<string, DailyMetric>();
    for (let d = new Date(since); d <= now; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      dailyMap.set(date, {
        date,
        followers: 0,
        impressions: 0,
        reach: 0,
        engagements: 0,
        posts_count: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      });
    }

    try {
      const statsResponse = await requestWithTimeIntervals<LinkedInFollowerStats>(
        `${API_URL}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${externalAccountId}`,
        'follower_stats'
      );

      const elements = statsResponse.elements ?? [];
      for (const element of elements) {
        const dateKey = element.timeRange?.start
          ? new Date(element.timeRange.start).toISOString().slice(0, 10)
          : null;
        if (!dateKey) continue;
        const entry = dailyMap.get(dateKey) ?? { date: dateKey };
        const totalFollowers =
          (element.followerCounts?.organicFollowerCount ?? 0) +
          (element.followerCounts?.paidFollowerCount ?? 0);
        entry.followers = totalFollowers;
        dailyMap.set(dateKey, entry);
        followers = totalFollowers;
      }
    } catch (error) {
      console.log('[linkedin] Could not fetch follower stats (may be personal profile)');
    }

    try {
      const shareStatsResponse = await requestWithTimeIntervals<LinkedInShareStats>(
        `${API_URL}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${externalAccountId}`,
        'share_stats'
      );

      for (const element of shareStatsResponse.elements ?? []) {
        const dateKey = element.timeRange?.start
          ? new Date(element.timeRange.start).toISOString().slice(0, 10)
          : null;
        if (!dateKey) continue;
        const entry = dailyMap.get(dateKey) ?? { date: dateKey };
        const stats = element.totalShareStatistics ?? {};
        const likes = stats.likeCount ?? 0;
        const comments = stats.commentCount ?? 0;
        const shares = stats.shareCount ?? 0;
        const impressions = stats.impressionCount ?? 0;
        entry.impressions = impressions;
        entry.reach = impressions;
        entry.views = impressions;
        entry.engagements = likes + comments + shares;
        entry.likes = likes;
        entry.comments = comments;
        entry.shares = shares;
        dailyMap.set(dateKey, entry);
      }
      shareStatsLoaded = true;
    } catch (error) {
      console.log('[linkedin] Could not fetch share stats:', error);
    }

    // Fetch recent posts and aggregate metrics by date
    const posts: PostMetric[] = [];

    try {
      // For organization pages
      const sharesResponse = await apiRequest<{ elements?: LinkedInPost[] }>(
        'linkedin',
        `${API_URL}/shares?q=owners&owners=urn:li:organization:${externalAccountId}&count=50&sharesPerOwner=50&projection=(elements*(id,created,specificContent,socialDetail))`,
        { headers },
        'shares'
      );

      if (sharesResponse.elements) {
        for (const post of sharesResponse.elements) {
          const content = post.specificContent?.['com.linkedin.ugc.ShareContent'];
          const stats = post.socialDetail?.totalShareStatistics;
          const postedAt = post.created?.time
            ? new Date(post.created.time).toISOString()
            : new Date().toISOString();

          // Aggregate metrics into daily totals
          const dateKey = postedAt.slice(0, 10);
          let dailyMetric = dailyMap.get(dateKey);

          // Create daily metric for this date if it doesn't exist
          if (!dailyMetric) {
            dailyMetric = {
              date: dateKey,
              followers: 0, // Don't set followers on past dates
              impressions: 0,
              reach: 0,
              engagements: 0,
              posts_count: 0,
              likes: 0,
              comments: 0,
              shares: 0,
            };
            dailyMap.set(dateKey, dailyMetric);
          }

          const likes = stats?.likeCount ?? 0;
          const comments = stats?.commentCount ?? 0;
          const shares = stats?.shareCount ?? 0;
          const impressions = stats?.impressionCount ?? 0;

          dailyMetric.posts_count = (dailyMetric.posts_count ?? 0) + 1;

          if (!shareStatsLoaded) {
            dailyMetric.impressions = (dailyMetric.impressions ?? 0) + impressions;
            dailyMetric.reach = (dailyMetric.reach ?? 0) + impressions;
            dailyMetric.views = (dailyMetric.views ?? 0) + impressions;
            dailyMetric.engagements = (dailyMetric.engagements ?? 0) + likes + comments + shares;
            dailyMetric.likes = (dailyMetric.likes ?? 0) + likes;
            dailyMetric.comments = (dailyMetric.comments ?? 0) + comments;
            dailyMetric.shares = (dailyMetric.shares ?? 0) + shares;
          }

          posts.push({
            external_post_id: post.id,
            posted_at: postedAt,
            caption: content?.shareCommentary?.text?.slice(0, 500),
            media_type: content?.media?.[0] ? 'image' : 'text',
            thumbnail_url: content?.media?.[0]?.thumbnails?.[0]?.url,
            metrics: {
              shares: stats?.shareCount ?? 0,
              likes: stats?.likeCount ?? 0,
              comments: stats?.commentCount ?? 0,
              impressions: stats?.impressionCount ?? 0,
              clicks: stats?.clickCount ?? 0,
            },
            raw_json: post as unknown as Record<string, unknown>,
          });
        }
      }
    } catch (error) {
      console.log('[linkedin] Could not fetch posts:', error);
    }

    // Add today's metric with current follower count (even if no posts)
    const today = new Date().toISOString().slice(0, 10);
    let todayMetric = dailyMap.get(today);

    if (!todayMetric) {
      todayMetric = {
        date: today,
        followers,
        impressions: 0,
        reach: 0,
        engagements: 0,
        posts_count: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
      dailyMap.set(today, todayMetric);
    } else {
      // Update today's metric with current follower count
      todayMetric.followers = followers;
    }

    // Convert map to array and sort by date
    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  },
};
