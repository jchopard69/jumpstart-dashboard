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
 * Fetch LinkedIn organization pages the user manages via DMA API
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<Array<{
  organizationId: string;
  name: string;
  logoUrl?: string;
}>> {
  const config = getLinkedInConfig();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'LinkedIn-Version': '202501',
  };

  try {
    // Step 1: Fetch DMA organization authorizations
    const authUrl = `${config.apiUrl}/dmaOrganizationAuthorizations?q=authorizingMember`;
    console.log('[linkedin] Fetching DMA authorizations from:', authUrl);

    const authResponse = await fetch(authUrl, { headers });
    console.log('[linkedin] DMA auth response status:', authResponse.status);

    const authData = await authResponse.json();
    console.log('[linkedin] DMA auth response:', JSON.stringify(authData, null, 2));

    if (authData.status && authData.status >= 400) {
      console.warn('[linkedin] DMA auth API error:', authData);
      return [];
    }

    // Extract organization IDs from authorizations
    const elements = authData.elements || [];
    console.log('[linkedin] Found', elements.length, 'authorization elements');

    const orgIds = new Set<string>();
    for (const element of elements) {
      const orgUrn = element.organization || element.authorizedOrganization;
      if (orgUrn) {
        const orgId = String(orgUrn).replace('urn:li:organization:', '');
        if (orgId && orgId !== 'undefined') {
          orgIds.add(orgId);
        }
      }
    }

    console.log('[linkedin] Extracted organization IDs:', Array.from(orgIds));

    if (orgIds.size === 0) {
      console.warn('[linkedin] No organization IDs found in DMA authorizations');
      return [];
    }

    // Step 2: Fetch organization details via DMA API
    const orgIdsList = Array.from(orgIds).join(',');
    const orgsUrl = `${config.apiUrl}/dmaOrganizations?ids=List(${orgIdsList})`;
    console.log('[linkedin] Fetching DMA organizations from:', orgsUrl);

    const orgsResponse = await fetch(orgsUrl, { headers });
    console.log('[linkedin] DMA orgs response status:', orgsResponse.status);

    const orgsData = await orgsResponse.json();
    console.log('[linkedin] DMA orgs response:', JSON.stringify(orgsData, null, 2));

    if (orgsData.status && orgsData.status >= 400) {
      console.warn('[linkedin] DMA orgs API error:', orgsData);
      return [];
    }

    // Parse organizations from results
    const results = orgsData.results || {};
    const organizations = Object.entries(results).map(([orgId, org]) => {
      const orgData = org as Record<string, unknown>;
      const logoV2 = orgData.logoV2 as Record<string, unknown> | undefined;
      const logoUrl = logoV2?.original as string | undefined;

      return {
        organizationId: orgId,
        name: (orgData.localizedName as string) || 'Unknown Organization',
        logoUrl,
      };
    });

    console.log(`[linkedin] Returning ${organizations.length} organizations via DMA API`);
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
    console.error('  4. The authorization was not approved in the API response');
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
