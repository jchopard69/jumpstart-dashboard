/**
 * YouTube/Google OAuth authentication
 */

import { getYouTubeConfig } from './config';
import { SocialAccount } from '../core/types';
import crypto from 'crypto';

type ParsedYouTubeState = {
  tenantId: string;
  returnToOrigin?: string;
  signed: boolean;
};

function getYouTubeStateSecret(): string {
  const config = getYouTubeConfig();
  return process.env.OAUTH_STATE_SECRET || process.env.ENCRYPTION_SECRET || config.clientSecret;
}

function signYouTubeStatePayload(payload: string): string {
  return crypto.createHmac('sha256', getYouTubeStateSecret()).update(payload).digest('base64url');
}

function signaturesMatch(actualSig: string, expectedSig: string): boolean {
  const actual = Buffer.from(actualSig);
  const expected = Buffer.from(expectedSig);
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Generate OAuth state parameter
 */
export function generateOAuthState(tenantId: string, returnToOrigin?: string): string {
  const payload = {
    tenantId,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
    returnToOrigin,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signYouTubeStatePayload(encodedPayload);
  return Buffer.from(JSON.stringify({ payload: encodedPayload, sig })).toString('base64url');
}

/**
 * Parse OAuth state
 */
export function parseOAuthState(state: string): ParsedYouTubeState {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    let rawPayload = parsed;
    let signed = false;

    if (parsed?.payload && parsed?.sig) {
      const expectedSig = signYouTubeStatePayload(parsed.payload);
      const actualSig = String(parsed.sig);
      if (!signaturesMatch(actualSig, expectedSig)) {
        throw new Error('Invalid state signature');
      }
      rawPayload = JSON.parse(Buffer.from(parsed.payload, 'base64url').toString('utf8'));
      signed = true;
    }

    if (!rawPayload.tenantId) {
      throw new Error('Invalid state: missing tenantId');
    }

    if (Date.now() - rawPayload.ts > 60 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    return {
      tenantId: rawPayload.tenantId,
      returnToOrigin: rawPayload.returnToOrigin,
      signed,
    };
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
    include_granted_scopes: 'true',
    prompt: 'consent select_account', // Force consent to ensure refresh token and show chooser
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
export async function fetchYouTubeChannels(accessToken: string): Promise<Array<{
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}>> {
  const config = getYouTubeConfig();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };
  const channels: Array<{
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
  }> = [];
  let nextPageToken = "";

  do {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      mine: 'true',
      maxResults: '50',
    });
    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }

    const response = await fetch(`${config.apiUrl}/channels?${params.toString()}`, { headers });
    const data = await response.json();

    if (data.error) {
      throw new Error(`YouTube API error: ${data.error.message || data.error.code}`);
    }

    for (const channel of data.items ?? []) {
      channels.push({
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url,
        subscriberCount: parseInt(channel.statistics.subscriberCount || '0', 10),
        viewCount: parseInt(channel.statistics.viewCount || '0', 10),
        videoCount: parseInt(channel.statistics.videoCount || '0', 10),
      });
    }

    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  if (channels.length === 0) {
    throw new Error('No YouTube channel found for this account');
  }

  return channels;
}

/**
 * Handle YouTube OAuth callback
 */
export async function handleYouTubeOAuthCallback(
  code: string,
  state: string
): Promise<{ tenantId: string; returnToOrigin?: string; accounts: SocialAccount[] }> {
  const { tenantId, returnToOrigin } = parseOAuthState(state);
  console.log(`[youtube-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // Exchange code for tokens
  const tokenData = await exchangeYouTubeCode(code);
  console.log(`[youtube-auth] Token exchange successful, expires in ${tokenData.expiresIn}s`);

  // Fetch all accessible channels, including brand channels when exposed by Google/YouTube.
  const channels = await fetchYouTubeChannels(tokenData.accessToken);
  console.log(`[youtube-auth] Channel info fetched: ${channels.map((channel) => channel.title).join(', ')}`);

  const accounts: SocialAccount[] = channels.map((channelInfo) => ({
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
      description: channelInfo.description,
    },
  }));

  return { tenantId, returnToOrigin, accounts };
}
