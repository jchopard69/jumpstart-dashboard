/**
 * LinkedIn Marketing API client for fetching analytics
 */

import { LINKEDIN_CONFIG } from './config';
import { apiRequest } from '../core/api-client';
import type { Connector } from '@/lib/connectors/types';
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
      console.log('[linkedin] Could not fetch follower stats (may be personal profile)');
    }

    // Initialize daily metrics map - only for dates with posts
    const dailyMap = new Map<string, DailyMetric>();

    // Fetch recent posts and aggregate metrics by date
    const posts: PostMetric[] = [];

    try {
      // For organization pages
      const sharesResponse = await apiRequest<{ elements?: LinkedInPost[] }>(
        'linkedin',
        `${API_URL}/shares?q=owners&owners=urn:li:organization:${externalAccountId}&count=50&sharesPerOwner=50`,
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
          dailyMetric.impressions = (dailyMetric.impressions ?? 0) + impressions;
          dailyMetric.reach = (dailyMetric.reach ?? 0) + impressions; // LinkedIn doesn't separate reach, use impressions
          dailyMetric.engagements = (dailyMetric.engagements ?? 0) + likes + comments + shares;
          dailyMetric.likes = (dailyMetric.likes ?? 0) + likes;
          dailyMetric.comments = (dailyMetric.comments ?? 0) + comments;
          dailyMetric.shares = (dailyMetric.shares ?? 0) + shares;

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
