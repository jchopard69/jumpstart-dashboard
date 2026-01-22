/**
 * Meta (Facebook + Instagram) OAuth authentication
 */

import { getMetaConfig, META_CONFIG } from './config';
import { SocialAccount } from '../core/types';
import { apiRequest, buildUrl } from '../core/api-client';
import crypto from 'crypto';

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: { data?: { url?: string } };
  fan_count?: number;
  followers_count?: number;
  instagram_business_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
    followers_count?: number;
  };
}

interface MetaPagesResponse {
  data: MetaPage[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
  };
}

interface MetaDebugTokenResponse {
  data?: {
    is_valid: boolean;
    app_id?: string;
    user_id?: string;
    scopes?: string[];
    expires_at?: number;
    error?: {
      code: number;
      message: string;
    };
  };
}

/**
 * Generate a secure state parameter for OAuth
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
 * Parse and validate OAuth state parameter
 */
export function parseOAuthState(state: string): { tenantId: string; ts: number; nonce: string } {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (!parsed.tenantId || !parsed.ts) {
      throw new Error('Invalid state: missing required fields');
    }

    // Check state is not too old (max 1 hour)
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - parsed.ts > maxAge) {
      throw new Error('OAuth state expired');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse OAuth state: ${error instanceof Error ? error.message : 'Invalid format'}`);
  }
}

/**
 * Generate Meta OAuth authorization URL
 */
export function generateMetaAuthUrl(tenantId: string, stateOverride?: string): string {
  const config = getMetaConfig();
  const state = stateOverride ?? generateOAuthState(tenantId);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(','),
    state: state,
    response_type: 'code',
    // Force re-authentication to ensure fresh permissions
    auth_type: 'rerequest',
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const config = getMetaConfig();

  const url = buildUrl(config.tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code: code,
  });

  console.log('[meta-auth] Exchanging code for token...');

  const response = await apiRequest<MetaTokenResponse>('facebook', url, {}, 'oauth/token');

  console.log('[meta-auth] Token exchange successful');
  return response;
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const config = getMetaConfig();

  const url = buildUrl(`${config.graphUrl}/oauth/access_token`, {
    grant_type: 'fb_exchange_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  console.log('[meta-auth] Exchanging for long-lived token...');

  const response = await apiRequest<MetaTokenResponse>('facebook', url, {}, 'oauth/long_lived');

  console.log(`[meta-auth] Long-lived token obtained, expires in ${response.expires_in} seconds`);
  return response;
}

/**
 * Debug/validate an access token
 */
export async function debugToken(accessToken: string): Promise<MetaDebugTokenResponse> {
  const config = getMetaConfig();
  const appToken = `${config.clientId}|${config.clientSecret}`;

  const url = buildUrl(`${config.graphUrl}/debug_token`, {
    input_token: accessToken,
    access_token: appToken,
  });

  const response = await apiRequest<MetaDebugTokenResponse>('facebook', url, {}, 'debug_token');

  console.log('[meta-auth] Token debug info:', {
    is_valid: response.data?.is_valid,
    scopes: response.data?.scopes,
    user_id: response.data?.user_id,
    expires_at: response.data?.expires_at
      ? new Date(response.data.expires_at * 1000).toISOString()
      : 'never',
  });

  return response;
}

/**
 * Fetch all Facebook Pages the user has access to
 */
export async function fetchUserPages(accessToken: string): Promise<MetaPage[]> {
  const config = getMetaConfig();

  console.log('[meta-auth] Fetching user pages...');

  const allPages: MetaPage[] = [];
  let nextUrl: string | null = buildUrl(`${config.graphUrl}/me/accounts`, {
    access_token: accessToken,
    fields: config.pageFields,
    limit: 100,
  });

  // Paginate through all pages
  while (nextUrl) {
    const response: MetaPagesResponse = await apiRequest<MetaPagesResponse>(
      'facebook',
      nextUrl,
      {},
      'me/accounts'
    );

    if (response.error) {
      console.error('[meta-auth] Error fetching pages:', response.error);
      throw new Error(`Failed to fetch pages: ${response.error.message} (code: ${response.error.code})`);
    }

    if (response.data) {
      allPages.push(...response.data);
    }

    nextUrl = response.paging?.next || null;
  }

  console.log(`[meta-auth] Found ${allPages.length} Facebook Pages`);

  // Log details for debugging
  for (const page of allPages) {
    console.log(`[meta-auth] Page: ${page.name} (${page.id})`, {
      hasInstagram: !!page.instagram_business_account,
      instagramUsername: page.instagram_business_account?.username,
    });
  }

  return allPages;
}

/**
 * Process Meta OAuth callback and return connected accounts
 */
export async function handleMetaOAuthCallback(
  code: string,
  state: string
): Promise<{ tenantId: string; accounts: SocialAccount[] }> {
  // 1. Validate state
  const { tenantId } = parseOAuthState(state);
  console.log(`[meta-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // 2. Exchange code for short-lived token
  const shortLivedTokenResponse = await exchangeCodeForToken(code);

  // 3. Exchange for long-lived token
  const longLivedTokenResponse = await getLongLivedToken(shortLivedTokenResponse.access_token);
  const userAccessToken = longLivedTokenResponse.access_token;
  const tokenExpiresAt = longLivedTokenResponse.expires_in
    ? new Date(Date.now() + longLivedTokenResponse.expires_in * 1000)
    : undefined;

  // 4. Debug the token to verify scopes
  const debugInfo = await debugToken(userAccessToken);
  if (!debugInfo.data?.is_valid) {
    throw new Error('Token validation failed: token is not valid');
  }

  const grantedScopes = debugInfo.data.scopes || [];
  console.log(`[meta-auth] Granted scopes: ${grantedScopes.join(', ')}`);

  // Check for critical scope
  if (!grantedScopes.includes('pages_show_list')) {
    throw new Error(
      'PERMISSION_ERROR: pages_show_list permission not granted. ' +
      'Please ensure this permission is approved in your Meta App Review.'
    );
  }

  // 5. Fetch all pages
  const pages = await fetchUserPages(userAccessToken);

  if (pages.length === 0) {
    console.warn('[meta-auth] No pages found. Possible causes:');
    console.warn('  - User has no Facebook Pages');
    console.warn('  - User is not admin/editor of any pages');
    console.warn('  - pages_show_list permission not approved in App Review');
    throw new Error(
      'NO_PAGES_FOUND: No Facebook Pages were returned. ' +
      'Please verify the user has admin access to at least one Facebook Page.'
    );
  }

  // 6. Build account objects
  const accounts: SocialAccount[] = [];

  for (const page of pages) {
    // Add Facebook Page account
    accounts.push({
      platform: 'facebook',
      platformUserId: page.id,
      accountName: page.name,
      profilePictureUrl: page.picture?.data?.url,
      accessToken: page.access_token, // Page-specific token (doesn't expire if page stays active)
      tokenExpiresAt: undefined, // Page tokens don't expire
      scopes: grantedScopes,
      metadata: {
        category: page.category,
        fanCount: page.fan_count,
        followersCount: page.followers_count,
      },
    });

    // Add Instagram Business account if linked
    if (page.instagram_business_account) {
      const ig = page.instagram_business_account;
      accounts.push({
        platform: 'instagram',
        platformUserId: ig.id,
        accountName: ig.username,
        accountUsername: `@${ig.username}`,
        profilePictureUrl: ig.profile_picture_url,
        accessToken: page.access_token, // Uses page token
        tokenExpiresAt: undefined, // Inherits from page token
        scopes: grantedScopes,
        metadata: {
          parentPageId: page.id,
          parentPageName: page.name,
          followersCount: ig.followers_count,
        },
      });
    }
  }

  console.log(`[meta-auth] OAuth complete. Found ${accounts.length} accounts (${pages.length} pages, ${accounts.length - pages.length} Instagram)`);

  return { tenantId, accounts };
}

/**
 * Diagnostic function to test Meta configuration
 */
export async function diagnoseMetaSetup(): Promise<{
  configValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check environment variables
  if (!process.env.META_APP_ID) {
    issues.push('META_APP_ID is not set');
  }
  if (!process.env.META_APP_SECRET) {
    issues.push('META_APP_SECRET is not set');
  }
  if (!process.env.META_REDIRECT_URI && !process.env.NEXT_PUBLIC_SITE_URL) {
    issues.push('META_REDIRECT_URI or NEXT_PUBLIC_SITE_URL must be set');
  }

  // Recommendations
  recommendations.push('Ensure your Meta App is in "Live" mode (not Development)');
  recommendations.push('Verify pages_show_list permission is approved in App Review');
  recommendations.push('Confirm the OAuth redirect URI matches exactly in Meta App settings');
  recommendations.push('The connecting user must be an admin/editor of Facebook Pages');

  return {
    configValid: issues.length === 0,
    issues,
    recommendations,
  };
}
