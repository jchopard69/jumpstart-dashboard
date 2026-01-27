/**
 * TikTok Business API client for fetching analytics
 */

import { TIKTOK_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = TIKTOK_CONFIG.apiUrl;

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

    const userInfoErrorCode = userInfoResponse.error?.code;
    const userInfoErrorMessage = userInfoResponse.error?.message?.toLowerCase();
    const userInfoCode = userInfoErrorCode !== undefined ? String(userInfoErrorCode) : "";
    const userInfoOk = userInfoCode === "0" || userInfoCode.toLowerCase() === "ok" || userInfoErrorMessage === "ok";
    if (userInfoResponse.error && !userInfoOk) {
      throw new Error(`TikTok API error: ${userInfoResponse.error.message}`);
    }

    const user = userInfoResponse.data?.user;
    if (!user) {
      throw new Error('Failed to fetch TikTok user info');
    }

    // Create daily metrics with current stats
    const today = new Date().toISOString().slice(0, 10);
    const dailyMetrics: DailyMetric[] = [{
      date: today,
      followers: user.follower_count ?? 0,
      likes: user.likes_count ?? 0,
      posts_count: user.video_count ?? 0,
      impressions: 0, // TikTok doesn't provide this at user level
      reach: 0,
      engagements: user.likes_count ?? 0,
      raw_json: user as unknown as Record<string, unknown>,
    }];

    // Fetch recent videos
    const videosResponse = await apiRequest<TikTokVideosResponse>(
      'tiktok',
      `${API_URL}/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count&max_count=10`,
      { headers },
      'video_list'
    );

    const posts: PostMetric[] = [];

    const videosErrorCode = videosResponse.error?.code;
    const videosErrorMessage = videosResponse.error?.message?.toLowerCase();
    const videosCode = videosErrorCode !== undefined ? String(videosErrorCode) : "";
    const videosOk = videosCode === "0" || videosCode.toLowerCase() === "ok" || videosErrorMessage === "ok";
    if (videosResponse.error && !videosOk) {
      throw new Error(`TikTok API error: ${videosResponse.error.message}`);
    }

    if (videosResponse.data?.videos) {
      for (const video of videosResponse.data.videos) {
        posts.push({
          external_post_id: video.id,
          posted_at: new Date(video.create_time * 1000).toISOString(),
          url: video.share_url,
          caption: video.title,
          media_type: 'video',
          thumbnail_url: video.cover_image_url,
          media_url: video.share_url,
          metrics: {
            views: video.view_count ?? 0,
            likes: video.like_count ?? 0,
            comments: video.comment_count ?? 0,
            shares: video.share_count ?? 0,
          },
          raw_json: video as unknown as Record<string, unknown>,
        });
      }
    }

    return { dailyMetrics, posts };
  },
};
