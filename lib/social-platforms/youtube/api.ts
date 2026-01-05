/**
 * YouTube Data API v3 client for fetching analytics
 */

import { getYouTubeConfig, YOUTUBE_CONFIG } from './config';
import { apiRequest, buildUrl } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = YOUTUBE_CONFIG.apiUrl;

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
  items: YouTubeChannel[];
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

interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
  }>;
}

interface YouTubeVideosResponse {
  items: YouTubeVideo[];
}

/**
 * YouTube connector
 */
export const youtubeConnector: Connector = {
  platform: 'youtube',

  async sync({ externalAccountId, accessToken }) {
    const config = getYouTubeConfig();

    // Determine auth method
    let authParam: string;
    let headers: Record<string, string> = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      authParam = '';
    } else if (config.apiKey) {
      authParam = `key=${config.apiKey}`;
    } else {
      throw new Error('No YouTube authentication available');
    }

    // Build URL helper
    const buildApiUrl = (endpoint: string, params: Record<string, string | number | undefined>) => {
      const url = buildUrl(`${API_URL}/${endpoint}`, params);
      if (authParam && !accessToken) {
        return `${url}&${authParam}`;
      }
      return url;
    };

    // Fetch channel statistics
    const channelUrl = buildApiUrl('channels', {
      part: 'statistics,snippet',
      id: externalAccountId,
    });

    const channelResponse = await apiRequest<YouTubeChannelResponse>(
      'youtube',
      channelUrl,
      { headers },
      'channels'
    );

    const channel = channelResponse.items?.[0];
    if (!channel) {
      throw new Error('Channel not found');
    }

    const stats = channel.statistics;
    const today = new Date().toISOString().slice(0, 10);

    // Create daily metrics
    const dailyMetrics: DailyMetric[] = [{
      date: today,
      followers: parseInt(stats.subscriberCount || '0', 10),
      views: parseInt(stats.viewCount || '0', 10),
      posts_count: parseInt(stats.videoCount || '0', 10),
      impressions: 0,
      reach: 0,
      engagements: 0,
      raw_json: {
        statistics: stats,
        snippet: channel.snippet,
      },
    }];

    // Fetch recent videos
    const searchUrl = buildApiUrl('search', {
      part: 'id',
      channelId: externalAccountId,
      order: 'date',
      maxResults: 10,
      type: 'video',
    });

    const searchResponse = await apiRequest<YouTubeSearchResponse>(
      'youtube',
      searchUrl,
      { headers },
      'search'
    );

    const videoIds = searchResponse.items
      ?.map(item => item.id.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) {
      return { dailyMetrics, posts: [] };
    }

    // Fetch video details
    const videosUrl = buildApiUrl('videos', {
      part: 'snippet,statistics',
      id: videoIds,
    });

    const videosResponse = await apiRequest<YouTubeVideosResponse>(
      'youtube',
      videosUrl,
      { headers },
      'videos'
    );

    const posts: PostMetric[] = (videosResponse.items || []).map(video => ({
      external_post_id: video.id,
      posted_at: video.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      caption: video.snippet.title,
      media_type: 'video',
      thumbnail_url: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
      media_url: `https://www.youtube.com/watch?v=${video.id}`,
      metrics: {
        views: parseInt(video.statistics.viewCount || '0', 10),
        likes: parseInt(video.statistics.likeCount || '0', 10),
        comments: parseInt(video.statistics.commentCount || '0', 10),
      },
      raw_json: video as unknown as Record<string, unknown>,
    }));

    return { dailyMetrics, posts };
  },
};
