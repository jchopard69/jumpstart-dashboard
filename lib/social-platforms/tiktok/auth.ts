/**
 * TikTok OAuth authentication with PKCE
 */

import { getTikTokConfig } from './config';
import { SocialAccount } from '../core/types';
import crypto from 'crypto';

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Generate code verifier for PKCE
 */
function generateCodeVerifier(): string {
  return generateRandomString(64);
}

/**
 * Generate code challenge from verifier (S256 method)
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

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

    // Check state age (max 1 hour)
    if (Date.now() - parsed.ts > 60 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse OAuth state: ${error instanceof Error ? error.message : 'Invalid format'}`);
  }
}

/**
 * Generate TikTok OAuth authorization URL and PKCE verifier
 */
export async function generateTikTokAuthRequest(tenantId: string, stateOverride?: string): Promise<{
  authUrl: string;
  state: string;
  codeVerifier: string;
}> {
  const config = getTikTokConfig();
  const state = stateOverride ?? generateOAuthState(tenantId);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_key: config.clientKey,
    scope: config.scopes.join(','),
    response_type: 'code',
    redirect_uri: config.redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    authUrl: `${config.authUrl}?${params.toString()}`,
    state,
    codeVerifier,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeTikTokCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  openId: string;
  scope: string;
}> {
  const config = getTikTokConfig();

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`TikTok OAuth error: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    openId: data.open_id,
    scope: data.scope,
  };
}

/**
 * Fetch TikTok user info
 */
export async function fetchTikTokUserInfo(accessToken: string): Promise<{
  openId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  followerCount?: number;
  videoCount?: number;
}> {
  const config = getTikTokConfig();

  const response = await fetch(`${config.apiUrl}/user/info/?fields=open_id,display_name,avatar_url,follower_count,video_count`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  const error = data.error as { code?: string | number; message?: string } | undefined;
  const errorCode = error?.code;
  const errorMessage = error?.message?.toLowerCase();
  const errorCodeStr = errorCode !== undefined ? String(errorCode) : "";
  const isOk = errorCodeStr === "0" || errorCodeStr.toLowerCase() === "ok" || errorMessage === "ok";
  if (error && !isOk) {
    throw new Error(`TikTok API error: ${data.error.message || data.error.code}`);
  }

  const user = data.data?.user;
  if (!user) {
    throw new Error('Failed to fetch TikTok user info');
  }

  return {
    openId: user.open_id,
    displayName: user.display_name,
    username: user.username || user.display_name,
    avatarUrl: user.avatar_url,
    followerCount: user.follower_count,
    videoCount: user.video_count,
  };
}

/**
 * Handle TikTok OAuth callback
 */
export async function handleTikTokOAuthCallback(
  code: string,
  state: string,
  codeVerifier: string
): Promise<{ tenantId: string; account: SocialAccount }> {
  // Parse state to get tenant ID
  const { tenantId } = parseOAuthState(state);
  console.log(`[tiktok-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // Exchange code for tokens
  const tokenData = await exchangeTikTokCode(code, codeVerifier);
  console.log(`[tiktok-auth] Token exchange successful, expires in ${tokenData.expiresIn}s`);

  // Fetch user info
  const userInfo = await fetchTikTokUserInfo(tokenData.accessToken);
  console.log(`[tiktok-auth] User info fetched: ${userInfo.displayName} (@${userInfo.username})`);

  const account: SocialAccount = {
    platform: 'tiktok',
    platformUserId: tokenData.openId,
    accountName: userInfo.displayName,
    accountUsername: `@${userInfo.username}`,
    profilePictureUrl: userInfo.avatarUrl,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
    scopes: tokenData.scope.split(','),
    metadata: {
      followerCount: userInfo.followerCount,
      videoCount: userInfo.videoCount,
    },
  };

  return { tenantId, account };
}
