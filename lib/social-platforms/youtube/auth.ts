/**
 * YouTube/Google OAuth authentication
 */

import { getYouTubeConfig } from './config';
import { SocialAccount } from '../core/types';
import crypto from 'crypto';

/**
 * Generate OAuth state parameter
 */
export function generateOAuthState(tenantId: string): string {
  const state = {
    tenantId,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  };
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/**
 * Parse OAuth state
 */
export function parseOAuthState(state: string): { tenantId: string } {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (!parsed.tenantId) {
      throw new Error('Invalid state: missing tenantId');
    }

    if (Date.now() - parsed.ts > 60 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse OAuth state: ${error instanceof Error ? error.message : 'Invalid format'}`);
  }
}

/**
 * Generate YouTube OAuth authorization URL
 */
export function generateYouTubeAuthUrl(tenantId: string, stateOverride?: string): string {
  const config = getYouTubeConfig();

  if (config.mode === 'api_key') {
    throw new Error('YouTube OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  const state = stateOverride ?? generateOAuthState(tenantId);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state: state,
    response_type: 'code',
    access_type: 'offline',  // Get refresh token
    prompt: 'consent',       // Force consent to ensure refresh token
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeYouTubeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const config = getYouTubeConfig();

  if (config.mode === 'api_key') {
    throw new Error('YouTube OAuth is not configured');
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.refresh_token) {
    console.warn('[youtube-auth] No refresh token received. User may have already authorized this app.');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in,
  };
}

/**
 * Fetch YouTube channel info
 */
export async function fetchYouTubeChannel(accessToken: string): Promise<{
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}> {
  const config = getYouTubeConfig();

  const response = await fetch(
    `${config.apiUrl}/channels?part=snippet,statistics&mine=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(`YouTube API error: ${data.error.message || data.error.code}`);
  }

  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this account');
  }

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount || '0', 10),
    viewCount: parseInt(channel.statistics.viewCount || '0', 10),
    videoCount: parseInt(channel.statistics.videoCount || '0', 10),
  };
}

/**
 * Handle YouTube OAuth callback
 */
export async function handleYouTubeOAuthCallback(
  code: string,
  state: string
): Promise<{ tenantId: string; account: SocialAccount }> {
  const { tenantId } = parseOAuthState(state);
  console.log(`[youtube-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // Exchange code for tokens
  const tokenData = await exchangeYouTubeCode(code);
  console.log(`[youtube-auth] Token exchange successful, expires in ${tokenData.expiresIn}s`);

  // Fetch channel info
  const channelInfo = await fetchYouTubeChannel(tokenData.accessToken);
  console.log(`[youtube-auth] Channel info fetched: ${channelInfo.title}`);

  const account: SocialAccount = {
    platform: 'youtube',
    platformUserId: channelInfo.channelId,
    accountName: channelInfo.title,
    profilePictureUrl: channelInfo.thumbnailUrl,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
    metadata: {
      subscriberCount: channelInfo.subscriberCount,
      viewCount: channelInfo.viewCount,
      videoCount: channelInfo.videoCount,
    },
  };

  return { tenantId, account };
}
