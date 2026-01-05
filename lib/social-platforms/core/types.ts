/**
 * Core types for social platform integrations
 */

export type PlatformId = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  apiVersion?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}

export interface SocialAccount {
  platform: PlatformId;
  platformUserId: string;
  accountName: string;
  accountUsername?: string;
  profilePictureUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface ConnectorSyncParams {
  tenantId: string;
  socialAccountId: string;
  externalAccountId: string;
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
}

export interface DailyMetric {
  date: string;
  followers?: number;
  impressions?: number;
  reach?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  watch_time?: number;
  posts_count?: number;
  raw_json?: Record<string, unknown>;
}

export interface PostMetric {
  external_post_id: string;
  posted_at: string;
  url?: string;
  caption?: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  metrics?: Record<string, number>;
  raw_json?: Record<string, unknown>;
}

export interface ConnectorSyncResult {
  dailyMetrics: DailyMetric[];
  posts: PostMetric[];
}

export interface Connector {
  platform: PlatformId;
  sync: (params: ConnectorSyncParams) => Promise<ConnectorSyncResult>;
}

export interface ApiError {
  platform: PlatformId;
  endpoint: string;
  statusCode: number;
  message: string;
  rawError?: unknown;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const PLATFORM_RATE_LIMITS: Record<PlatformId, RateLimitConfig> = {
  facebook: { maxRequests: 200, windowMs: 60 * 60 * 1000 }, // 200/hour
  instagram: { maxRequests: 200, windowMs: 60 * 60 * 1000 }, // 200/hour
  tiktok: { maxRequests: 100, windowMs: 60 * 1000 }, // 100/minute
  youtube: { maxRequests: 10000, windowMs: 24 * 60 * 60 * 1000 }, // 10k/day
  twitter: { maxRequests: 300, windowMs: 15 * 60 * 1000 }, // 300/15min
  linkedin: { maxRequests: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100/day
};
