/**
 * Token manager for automatic refresh and validation
 */

import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { encryptToken, decryptToken } from '@/lib/crypto';
import { PlatformId, OAuthTokens } from './types';

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';

// Token refresh buffer: refresh tokens if they expire within this time
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Get decrypted tokens for a social account
 */
export async function getDecryptedTokens(accountId: string): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  platform: PlatformId;
}> {
  const supabase = createSupabaseServiceClient();

  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('token_encrypted, refresh_token_encrypted, token_expires_at, platform')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  if (!ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET is not configured');
  }

  return {
    accessToken: account.token_encrypted ? decryptToken(account.token_encrypted, ENCRYPTION_SECRET) : null,
    refreshToken: account.refresh_token_encrypted ? decryptToken(account.refresh_token_encrypted, ENCRYPTION_SECRET) : null,
    expiresAt: account.token_expires_at ? new Date(account.token_expires_at) : null,
    platform: account.platform as PlatformId,
  };
}

/**
 * Check if token needs refresh
 */
export function tokenNeedsRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return false; // No expiration = doesn't need refresh (e.g., Facebook page tokens)
  }

  const now = new Date();
  const bufferTime = new Date(now.getTime() + REFRESH_BUFFER_MS);

  return expiresAt <= bufferTime;
}

/**
 * Update tokens in database
 */
export async function updateStoredTokens(
  accountId: string,
  tokens: TokenRefreshResult
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  if (!ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET is not configured');
  }

  const updateData: Record<string, unknown> = {
    token_encrypted: encryptToken(tokens.accessToken, ENCRYPTION_SECRET),
    auth_status: 'active',
    updated_at: new Date().toISOString(),
  };

  if (tokens.refreshToken) {
    updateData.refresh_token_encrypted = encryptToken(tokens.refreshToken, ENCRYPTION_SECRET);
  }

  if (tokens.expiresAt) {
    updateData.token_expires_at = tokens.expiresAt.toISOString();
  }

  const { error } = await supabase
    .from('social_accounts')
    .update(updateData)
    .eq('id', accountId);

  if (error) {
    throw new Error(`Failed to update tokens: ${error.message}`);
  }
}

/**
 * Mark account as needing re-authentication
 */
export async function markAccountExpired(accountId: string, errorMessage?: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('social_accounts')
    .update({
      auth_status: 'expired',
      last_error: errorMessage || 'Token expired - manual reconnection required',
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  if (error) {
    console.error(`Failed to mark account expired: ${error.message}`);
  }
}

/**
 * Refresh TikTok access token
 */
export async function refreshTikTokToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`TikTok token refresh failed: ${data.error.message || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Refresh YouTube/Google access token
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`YouTube token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    // Google doesn't return a new refresh token, keep the old one
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Refresh Twitter/X access token
 */
export async function refreshTwitterToken(refreshToken: string): Promise<TokenRefreshResult> {
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Twitter token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Refresh LinkedIn access token
 */
export async function refreshLinkedInToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`LinkedIn token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Validate Meta (Facebook/Instagram) token
 */
export async function validateMetaToken(accessToken: string): Promise<boolean> {
  const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;

  const response = await fetch(
    `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
  );

  const data = await response.json();
  return data.data?.is_valid === true;
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const { accessToken, refreshToken, expiresAt, platform } = await getDecryptedTokens(accountId);

  if (!accessToken) {
    throw new Error('No access token stored for account');
  }

  // Check if token needs refresh
  if (!tokenNeedsRefresh(expiresAt)) {
    return accessToken;
  }

  console.log(`[token-manager] Token expiring soon for ${accountId}, attempting refresh`);

  // Refresh based on platform
  try {
    let newTokens: TokenRefreshResult;

    switch (platform) {
      case 'tiktok':
        if (!refreshToken) throw new Error('No refresh token available');
        newTokens = await refreshTikTokToken(refreshToken);
        break;

      case 'youtube':
        if (!refreshToken) throw new Error('No refresh token available');
        newTokens = await refreshYouTubeToken(refreshToken);
        break;

      case 'twitter':
        if (!refreshToken) throw new Error('No refresh token available');
        newTokens = await refreshTwitterToken(refreshToken);
        break;

      case 'linkedin':
        if (!refreshToken) throw new Error('No refresh token available');
        newTokens = await refreshLinkedInToken(refreshToken);
        break;

      case 'facebook':
      case 'instagram':
        // Facebook page tokens don't expire if the page is active
        // Validate the token instead
        const isValid = await validateMetaToken(accessToken);
        if (!isValid) {
          await markAccountExpired(accountId, 'Meta token invalid - manual reconnection required');
          throw new Error('Meta token expired - manual reconnection required');
        }
        return accessToken;

      default:
        throw new Error(`Token refresh not supported for platform: ${platform}`);
    }

    // Store the new tokens
    await updateStoredTokens(accountId, newTokens);
    console.log(`[token-manager] Token refreshed successfully for ${accountId}`);

    return newTokens.accessToken;
  } catch (error) {
    console.error(`[token-manager] Token refresh failed for ${accountId}:`, error);
    await markAccountExpired(accountId, error instanceof Error ? error.message : 'Token refresh failed');
    throw error;
  }
}

/**
 * Refresh all expiring tokens (for cron job)
 */
export async function refreshAllExpiringTokens(): Promise<{
  refreshed: number;
  failed: number;
  results: Array<{ accountId: string; status: 'success' | 'error'; error?: string }>;
}> {
  const supabase = createSupabaseServiceClient();

  // Get accounts expiring in the next 24 hours
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: expiringAccounts, error } = await supabase
    .from('social_accounts')
    .select('id, platform')
    .lt('token_expires_at', tomorrow.toISOString())
    .eq('auth_status', 'active')
    .not('platform', 'in', '(facebook,instagram)'); // Meta tokens don't need proactive refresh

  if (error) {
    throw new Error(`Failed to fetch expiring accounts: ${error.message}`);
  }

  const results: Array<{ accountId: string; status: 'success' | 'error'; error?: string }> = [];

  for (const account of expiringAccounts || []) {
    try {
      await getValidAccessToken(account.id);
      results.push({ accountId: account.id, status: 'success' });
    } catch (err) {
      results.push({
        accountId: account.id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    refreshed: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  };
}
