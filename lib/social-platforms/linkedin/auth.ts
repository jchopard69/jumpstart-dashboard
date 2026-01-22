/**
 * LinkedIn OAuth 2.0 authentication
 */

import { getLinkedInConfig } from './config';
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
 * Uses the DMA Organization Access Control API (DMA-only)
 * See: https://learn.microsoft.com/en-us/linkedin/dma/pages-data-portability-overview
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<Array<{
  organizationId: string;
  name: string;
  logoUrl?: string;
}>> {
  const config = getLinkedInConfig();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'LinkedIn-Version': '202411',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  try {
    // Step 1: Get organizations where user is admin using DMA access control
    const aclsUrl = `${config.apiUrl}/dmaOrganizationAcls?q=roleAssignee&role=(value:ADMINISTRATOR)&state=(value:APPROVED)&start=0&count=100`;
    console.log('[linkedin] Fetching DMA organization ACLs from:', aclsUrl);

    const aclsResponse = await fetch(aclsUrl, { headers });
    console.log('[linkedin] ACL response status:', aclsResponse.status);

    const aclsData = await aclsResponse.json();
    console.log('[linkedin] ACL response:', JSON.stringify(aclsData, null, 2));

    if (aclsData.status && aclsData.status >= 400) {
      console.warn('[linkedin] ACL API error:', aclsData);
      return [];
    }

    // Extract organization IDs from ACLs
    const elements = aclsData.elements || [];
    console.log('[linkedin] Found', elements.length, 'ACL elements');

    const orgIds = new Set<string>();
    for (const element of elements) {
      const orgUrn = element?.key?.organization;
      if (orgUrn) {
        const orgId = String(orgUrn).replace('urn:li:organization:', '');
        if (orgId && orgId !== 'undefined') {
          orgIds.add(orgId);
        }
      }
    }

    console.log('[linkedin] Extracted organization IDs:', Array.from(orgIds));

    if (orgIds.size === 0) {
      console.warn('[linkedin] No organization IDs found in ACLs');
      return [];
    }

    // Step 2: Fetch organization details
    const organizations: Array<{ organizationId: string; name: string; logoUrl?: string }> = [];

    for (const orgId of orgIds) {
      try {
        const orgUrl = `${config.apiUrl}/dmaOrganizations/${orgId}`;
        console.log('[linkedin] Fetching org details from:', orgUrl);

        const orgResponse = await fetch(orgUrl, { headers });
        console.log('[linkedin] Org response status:', orgResponse.status);

        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          console.log('[linkedin] Org data:', JSON.stringify(orgData, null, 2));

          const logoV2 = orgData.logoV2 as Record<string, unknown> | undefined;
          const original = logoV2?.original as Record<string, unknown> | undefined;
          const logoUrl = original?.url as string | undefined;

          organizations.push({
            organizationId: orgId,
            name: orgData.localizedName || orgData.name?.localized?.en_US || 'Unknown Organization',
            logoUrl,
          });
        } else {
          console.warn(`[linkedin] Failed to fetch org ${orgId}:`, orgResponse.status);
        }
      } catch (error) {
        console.warn(`[linkedin] Error fetching org ${orgId}:`, error);
      }
    }

    console.log(`[linkedin] Returning ${organizations.length} organizations`);
    return organizations;
  } catch (error) {
    console.warn('[linkedin] Error fetching organizations:', error);
    return [];
  }
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

  const tokenExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);
  const accounts: SocialAccount[] = [];

  // Fetch and add organization pages
  const organizations = await fetchLinkedInOrganizations(tokenData.accessToken);
  console.log(`[linkedin-auth] Found ${organizations.length} organization pages`);
  console.log(`[linkedin-auth] Organizations details:`, JSON.stringify(organizations, null, 2));

  if (!organizations.length) {
    console.error('[linkedin-auth] No organizations found. This could mean:');
    console.error('  1. The user does not have admin access to any LinkedIn Organization Pages');
    console.error('  2. The OAuth scope r_dma_admin_pages_content is missing or not approved');
    console.error('  3. The LinkedIn app is not approved for DMA access');
    console.error('  4. The DMA Organization Access Control API returned no approved ACLs');
    throw new Error("Aucune page LinkedIn administrée n'a été trouvée pour ce compte.");
  }

  for (const org of organizations) {
    accounts.push({
      platform: 'linkedin',
      platformUserId: org.organizationId,
      accountName: org.name,
      profilePictureUrl: org.logoUrl,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt,
      metadata: {
        accountType: 'organization',
        organizationId: org.organizationId,
      },
    });
  }

  return { tenantId, accounts };
}
