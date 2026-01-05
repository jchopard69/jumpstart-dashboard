/**
 * LinkedIn Marketing API client for fetching analytics
 */

import { LINKEDIN_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector, ConnectorSyncResult } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_URL = LINKEDIN_CONFIG.apiUrl;

interface LinkedInFollowerStats {
  followerCounts?: {
    organicFollowerCount?: number;
    paidFollowerCount?: number;
  };
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

    const today = new Date().toISOString().slice(0, 10);
    let followers = 0;

    // Try to get follower statistics for organization pages
    try {
      const statsResponse = await apiRequest<LinkedInFollowerStats>(
        'linkedin',
        `${API_URL}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${externalAccountId}`,
        { headers },
        'follower_stats'
      );

      followers = (statsResponse.followerCounts?.organicFollowerCount || 0) +
                  (statsResponse.followerCounts?.paidFollowerCount || 0);
    } catch (error) {
      // This might fail for personal profiles, which is expected
      console.log('[linkedin] Could not fetch follower stats (may be personal profile)');
    }

    // Create daily metrics
    const dailyMetrics: DailyMetric[] = [{
      date: today,
      followers,
      impressions: 0,
      reach: 0,
      engagements: 0,
      posts_count: 0,
    }];

    // Try to fetch recent posts/shares
    const posts: PostMetric[] = [];

    try {
      // For organization pages
      const sharesResponse = await apiRequest<{ elements?: LinkedInPost[] }>(
        'linkedin',
        `${API_URL}/shares?q=owners&owners=urn:li:organization:${externalAccountId}&count=10&sharesPerOwner=10`,
        { headers },
        'shares'
      );

      if (sharesResponse.elements) {
        for (const post of sharesResponse.elements) {
          const content = post.specificContent?.['com.linkedin.ugc.ShareContent'];
          const stats = post.socialDetail?.totalShareStatistics;

          posts.push({
            external_post_id: post.id,
            posted_at: post.created?.time
              ? new Date(post.created.time).toISOString()
              : new Date().toISOString(),
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

    return { dailyMetrics, posts };
  },
};
