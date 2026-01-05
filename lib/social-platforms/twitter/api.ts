/**
 * X/Twitter API v2 client for fetching analytics
 */

import { TWITTER_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = TWITTER_CONFIG.apiUrl;

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

interface TwitterUserResponse {
  data: TwitterUser;
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

interface TwitterTweetsResponse {
  data?: TwitterTweet[];
  includes?: {
    media?: Array<{
      media_key: string;
      type: string;
      url?: string;
      preview_image_url?: string;
    }>;
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

/**
 * Twitter/X connector
 */
export const twitterConnector: Connector = {
  platform: 'twitter',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing Twitter access token');
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
    };

    // Fetch user info for metrics
    const userResponse = await apiRequest<TwitterUserResponse>(
      'twitter',
      `${API_URL}/users/${externalAccountId}?user.fields=public_metrics`,
      { headers },
      'users'
    );

    const user = userResponse.data;
    if (!user) {
      throw new Error('Failed to fetch Twitter user');
    }

    const today = new Date().toISOString().slice(0, 10);
    const metrics = user.public_metrics;

    // Create daily metrics
    const dailyMetrics: DailyMetric[] = [{
      date: today,
      followers: metrics?.followers_count ?? 0,
      posts_count: metrics?.tweet_count ?? 0,
      impressions: 0, // Not available at user level
      reach: 0,
      engagements: 0,
      raw_json: user as unknown as Record<string, unknown>,
    }];

    // Fetch recent tweets
    const tweetsResponse = await apiRequest<TwitterTweetsResponse>(
      'twitter',
      `${API_URL}/users/${externalAccountId}/tweets?max_results=10&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=type,url,preview_image_url`,
      { headers },
      'tweets'
    );

    const posts: PostMetric[] = [];

    if (tweetsResponse.data) {
      // Build media lookup
      const mediaLookup = new Map<string, { type: string; url?: string; preview?: string }>();
      if (tweetsResponse.includes?.media) {
        for (const media of tweetsResponse.includes.media) {
          mediaLookup.set(media.media_key, {
            type: media.type,
            url: media.url,
            preview: media.preview_image_url,
          });
        }
      }

      for (const tweet of tweetsResponse.data) {
        // Get first media if available
        let thumbnailUrl: string | undefined;
        let mediaType = 'text';
        if (tweet.attachments?.media_keys?.[0]) {
          const media = mediaLookup.get(tweet.attachments.media_keys[0]);
          if (media) {
            thumbnailUrl = media.preview || media.url;
            mediaType = media.type;
          }
        }

        const tweetMetrics = tweet.public_metrics;

        posts.push({
          external_post_id: tweet.id,
          posted_at: tweet.created_at,
          url: `https://twitter.com/${user.username}/status/${tweet.id}`,
          caption: tweet.text.slice(0, 280),
          media_type: mediaType,
          thumbnail_url: thumbnailUrl,
          metrics: {
            likes: tweetMetrics?.like_count ?? 0,
            retweets: tweetMetrics?.retweet_count ?? 0,
            replies: tweetMetrics?.reply_count ?? 0,
            quotes: tweetMetrics?.quote_count ?? 0,
            impressions: tweetMetrics?.impression_count ?? 0,
          },
          raw_json: tweet as unknown as Record<string, unknown>,
        });
      }
    }

    return { dailyMetrics, posts };
  },
};
