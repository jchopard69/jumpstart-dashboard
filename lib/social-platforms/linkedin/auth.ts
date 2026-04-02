/**
 * LinkedIn OAuth 2.0 authentication
 */

import { getLinkedInConfig } from './config';
import { SocialAccount } from '../core/types';
import crypto from 'crypto';
import { fetchLinkedInOrganizations as fetchLinkedInCommunityOrganizations } from './community';

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
 * Generate LinkedIn OAuth authorization URL
 */
export function generateLinkedInAuthUrl(tenantId: string, stateOverride?: string): string {
  const config = getLinkedInConfig();
  const state = stateOverride ?? generateOAuthState(tenantId);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state: state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeLinkedInCode(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
}> {
  const config = getLinkedInConfig();

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`LinkedIn OAuth error: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
  };
}

/**
 * Fetch LinkedIn user profile
 */
export async function fetchLinkedInProfile(accessToken: string): Promise<{
  sub: string;
  name: string;
  email?: string;
  picture?: string;
}> {
  // Use the OpenID Connect userinfo endpoint
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`LinkedIn API error: ${data.error_description || data.error}`);
  }

  return {
    sub: data.sub,
    name: data.name,
    email: data.email,
    picture: data.picture,
  };
}

/**
 * Fetch LinkedIn organization pages the user manages
 * Uses LinkedIn Community Management APIs.
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<Array<{
  organizationId: string;
  organizationUrn: string;
  name: string;
  pageUrl?: string;
}>> {
  return fetchLinkedInCommunityOrganizations(accessToken);
}

/**
 * Handle LinkedIn OAuth callback
 */
export async function handleLinkedInOAuthCallback(
  code: string,
  state: string
): Promise<{ tenantId: string; accounts: SocialAccount[] }> {
  const { tenantId } = parseOAuthState(state);
  console.log(`[linkedin-auth] Processing OAuth callback for tenant: ${tenantId}`);

  // Exchange code for tokens
  const tokenData = await exchangeLinkedInCode(code);
  console.log(`[linkedin-auth] Token exchange successful, expires in ${tokenData.expiresIn}s`);
  if (tokenData.scope) {
    console.log(`[linkedin-auth] Granted scopes: ${tokenData.scope}`);
  }

  const tokenExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);
  const accounts: SocialAccount[] = [];

  // Fetch and add organization pages
  const organizations = await fetchLinkedInOrganizations(tokenData.accessToken);
  console.log(`[linkedin-auth] Found ${organizations.length} organization pages`);
  console.log(`[linkedin-auth] Organizations details:`, JSON.stringify(organizations, null, 2));

  if (!organizations.length) {
    console.error('[linkedin-auth] No organizations found. This could mean:');
    console.error('  1. The user does not have admin access to any LinkedIn Organization Pages');
    console.error('  2. Missing required Community Management scopes (r_organization_admin, rw_organization_admin, r_organization_social)');
    console.error('  3. The LinkedIn app is not approved for Community Management / Organizations APIs');
    console.error('  4. The organizationAcls endpoint returned no approved administrator ACLs');
    throw new Error("Aucune page LinkedIn administrée n'a été trouvée pour ce compte.");
  }

  for (const org of organizations) {
    accounts.push({
      platform: 'linkedin',
      platformUserId: org.organizationId,
      accountName: org.name,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt,
      metadata: {
        accountType: 'organization',
        organizationId: org.organizationId,
        organizationUrn: org.organizationUrn,
        pageUrl: org.pageUrl,
      },
    });
  }

  return { tenantId, accounts };
}
