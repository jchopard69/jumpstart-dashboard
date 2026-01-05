/**
 * X/Twitter OAuth 2.0 authentication with PKCE
 */

import { getTwitterConfig } from './config';
import { SocialAccount } from '../core/types';
import crypto from 'crypto';

// Store code verifiers temporarily
const codeVerifiers = new Map<string, { verifier: string; expires: number }>();

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
function generateCodeChallenge(verifier: string): string {
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

    if (Date.now() - parsed.ts > 60 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse OAuth state: ${error instanceof Error ? error.message : 'Invalid format'}`);
  }
}

/**
 * Store code verifier for PKCE
 */
export function storeCodeVerifier(state: string, verifier: string): void {
  // Clean up expired verifiers
  const now = Date.now();
  for (const [key, value] of codeVerifiers.entries()) {
    if (value.expires < now) {
      codeVerifiers.delete(key);
    }
  }

  codeVerifiers.set(state, {
    verifier,
    expires: now + 10 * 60 * 1000,
  });
}

/**
 * Retrieve and remove code verifier
 */
export function retrieveCodeVerifier(state: string): string {
  const entry = codeVerifiers.get(state);
  if (!entry) {
    throw new Error('Code verifier not found or expired');
  }

  codeVerifiers.delete(state);

  if (entry.expires < Date.now()) {
    throw new Error('Code verifier expired');
  }

  return entry.verifier;
}

/**
 * Generate Twitter OAuth authorization URL
 */
export function generateTwitterAuthUrl(tenantId: string): string {
  const config = getTwitterConfig();
  const state = generateOAuthState(tenantId);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier for callback
  storeCodeVerifier(state, codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeTwitterCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const config = getTwitterConfig();

  // Twitter requires Basic auth with client credentials
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Twitter OAuth error: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Fetch Twitter user info
 */
export async function fetchTwitterUser(accessToken: string): Promise<{
  id: string;
  name: string;
  username: string;
  profileImageUrl: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
}> {
  const config = getTwitterConfig();

  const response = await fetch(
    `${config.apiUrl}/users/me?user.fields=profile_image_url,public_metrics`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Twitter API error: ${data.errors[0]?.message || 'Unknown error'}`);
  }

  const user = data.data;
  if (!user) {
    throw new Error('Failed to fetch Twitter user info');
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    profileImageUrl: user.profile_image_url,
    followersCount: user.public_metrics?.followers_count || 0,
    followingCount: user.public_metrics?.following_count || 0,
    tweetCount: user.public_metrics?.tweet_count || 0,
  };
}

/**
 * Handle Twitter OAuth callback
 */
export async function handleTwitterOAuthCallback(
  code: string,
  state: string
): Promise<{ tenantId: string; account: SocialAccount }> {
  const { tenantId } = parseOAuthState(state);
  console.log(`[twitter-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // Retrieve code verifier
  const codeVerifier = retrieveCodeVerifier(state);

  // Exchange code for tokens
  const tokenData = await exchangeTwitterCode(code, codeVerifier);
  console.log(`[twitter-auth] Token exchange successful, expires in ${tokenData.expiresIn}s`);

  // Fetch user info
  const userInfo = await fetchTwitterUser(tokenData.accessToken);
  console.log(`[twitter-auth] User info fetched: ${userInfo.name} (@${userInfo.username})`);

  const account: SocialAccount = {
    platform: 'twitter',
    platformUserId: userInfo.id,
    accountName: userInfo.name,
    accountUsername: `@${userInfo.username}`,
    profilePictureUrl: userInfo.profileImageUrl,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
    metadata: {
      followersCount: userInfo.followersCount,
      followingCount: userInfo.followingCount,
      tweetCount: userInfo.tweetCount,
    },
  };

  return { tenantId, account };
}
