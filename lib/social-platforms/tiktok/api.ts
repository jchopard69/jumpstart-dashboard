/**
 * TikTok Business API client for fetching analytics
 */

import { TIKTOK_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = TIKTOK_CONFIG.apiUrl;
const MAX_PAGES = 10; // Limit pagination to avoid timeouts (10 pages * 20 videos = 200 videos max)

interface TikTokVideo {
  id: string;
  title?: string;
  cover_image_url?: string;
  share_url?: string;
  create_time: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

interface TikTokVideosResponse {
  data?: {
    videos: TikTokVideo[];
    cursor?: number;
    has_more?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface TikTokUserInfoResponse {
  data?: {
    user: {
      open_id: string;
      display_name: string;
      avatar_url: string;
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

function isResponseOk(error?: { code?: string; message?: string }): boolean {
  if (!error) return true;
  const errorCode = error.code !== undefined ? String(error.code).toLowerCase() : "";
  const errorMessage = error.message?.toLowerCase() ?? "";
  return errorCode === "0" || errorCode === "ok" || errorMessage === "ok";
}

/**
 * TikTok connector
 */
export const tiktokConnector: Connector = {
  platform: 'tiktok',

  async sync({ accessToken }) {
    if (!accessToken) {
      throw new Error('Missing TikTok access token');
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
    };

    // Fetch user info for follower count
    const userInfoResponse = await apiRequest<TikTokUserInfoResponse>(
      'tiktok',
      `${API_URL}/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count`,
      { headers },
      'user_info'
    );

    if (userInfoResponse.error && !isResponseOk(userInfoResponse.error)) {
      throw new Error(`TikTok API error: ${userInfoResponse.error.message}`);
    }

    const user = userInfoResponse.data?.user;
    if (!user) {
      throw new Error('Failed to fetch TikTok user info');
    }

    // Fetch all videos with pagination (POST request required by TikTok API v2)
    const allVideos: TikTokVideo[] = [];
    let cursor: number | undefined;
    let hasMore = true;
    let page = 0;

    while (hasMore && page < MAX_PAGES) {
      const body: { max_count: number; cursor?: number } = { max_count: 20 };
      if (cursor !== undefined) {
        body.cursor = cursor;
      }

      const videosResponse = await apiRequest<TikTokVideosResponse>(
        'tiktok',
        `${API_URL}/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        'video_list'
      );

      if (videosResponse.error && !isResponseOk(videosResponse.error)) {
        throw new Error(`TikTok API error: ${videosResponse.error.message}`);
      }

      if (videosResponse.data?.videos) {
        allVideos.push(...videosResponse.data.videos);
      }

      hasMore = videosResponse.data?.has_more ?? false;
      cursor = videosResponse.data?.cursor;
      page++;
    }

    // Process videos into posts and aggregate metrics by date
    const posts: PostMetric[] = [];
    const metricsByDate = new Map<string, {
      views: number;
      engagements: number;
      likes: number;
      comments: number;
      shares: number;
      posts_count: number;
    }>();

    for (const video of allVideos) {
      const views = video.view_count ?? 0;
      const likes = video.like_count ?? 0;
      const comments = video.comment_count ?? 0;
      const shares = video.share_count ?? 0;
      const postedAt = new Date(video.create_time * 1000);
      const dateKey = postedAt.toISOString().slice(0, 10);

      // Aggregate metrics by date
      const existing = metricsByDate.get(dateKey) ?? {
        views: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        posts_count: 0,
      };
      existing.views += views;
      existing.engagements += likes + comments + shares;
      existing.likes += likes;
      existing.comments += comments;
      existing.shares += shares;
      existing.posts_count += 1;
      metricsByDate.set(dateKey, existing);

      posts.push({
        external_post_id: video.id,
        posted_at: postedAt.toISOString(),
        url: video.share_url,
        caption: video.title,
        media_type: 'video',
        thumbnail_url: video.cover_image_url,
        media_url: video.share_url,
        metrics: {
          views,
          likes,
          comments,
          shares,
        },
        raw_json: video as unknown as Record<string, unknown>,
      });
    }

    // Create daily metrics from aggregated video stats
    const today = new Date().toISOString().slice(0, 10);
    const dailyMetrics: DailyMetric[] = [];

    // Add today's entry with current user stats
    const todayStats = metricsByDate.get(today);
    dailyMetrics.push({
      date: today,
      followers: user.follower_count ?? 0,
      likes: user.likes_count ?? 0,
      posts_count: todayStats?.posts_count ?? 0,
      impressions: todayStats?.views ?? 0,
      reach: todayStats?.views ?? 0,
      engagements: todayStats?.engagements ?? 0,
      raw_json: user as unknown as Record<string, unknown>,
    });

    // Add historical entries for dates with video posts
    for (const [date, stats] of metricsByDate) {
      if (date === today) continue; // Already added above

      dailyMetrics.push({
        date,
        followers: user.follower_count ?? 0, // We don't have historical follower data
        likes: stats.likes,
        posts_count: stats.posts_count,
        impressions: stats.views,
        reach: stats.views,
        engagements: stats.engagements,
        raw_json: undefined,
      });
    }

    // Sort by date ascending
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  },
};
