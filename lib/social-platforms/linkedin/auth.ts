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
 * Uses Organization Access Control (Community Management / Organizations)
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<Array<{
  organizationId: string;
  name: string;
  logoUrl?: string;
}>> {
  const config = getLinkedInConfig();
  if (config.version) {
    console.log('[linkedin] Using LinkedIn-Version:', config.version);
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
  };
  if (config.version) {
    headers['LinkedIn-Version'] = config.version;
  }

  try {
    // Step 1: Get organizations where user is admin using Organization Access Control
    const aclsUrl = `${config.apiUrl}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&start=0&count=100`;
    console.log('[linkedin] Fetching organization ACLs from:', aclsUrl);

    const aclsResponse = await fetch(aclsUrl, { headers });
    console.log('[linkedin] ACL response status:', aclsResponse.status);

    const aclsData = await aclsResponse.json();
    console.log('[linkedin] ACL response:', JSON.stringify(aclsData, null, 2));
    if (aclsData?.errorDetails) {
      console.warn('[linkedin] ACL errorDetails:', JSON.stringify(aclsData.errorDetails, null, 2));
    }

    if (aclsData.status && aclsData.status >= 400) {
      console.warn('[linkedin] ACL API error:', aclsData);
      const code = typeof aclsData.code === 'string' ? aclsData.code : '';
      const message = typeof aclsData.message === 'string' ? aclsData.message : 'LinkedIn organization ACL error';
      throw new Error(`LinkedIn org ACL error ${aclsData.status}${code ? ` (${code})` : ''}: ${message}`);
    }

    // Extract organization IDs from ACLs
    const elements = aclsData.elements || [];
    console.log('[linkedin] Found', elements.length, 'ACL elements');

    const orgIds = new Set<string>();
    for (const element of elements) {
      const orgUrn = element?.organizationTarget || element?.organization || element?.key?.organization;
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

    // Step 2: Fetch organization details (batch if possible)
    const organizations: Array<{ organizationId: string; name: string; logoUrl?: string }> = [];
    const idsList = Array.from(orgIds);
    try {
      const idsParam = `List(${idsList.join(',')})`;
      const orgsUrl = `${config.apiUrl}/organizations?ids=${encodeURIComponent(idsParam)}`;
      console.log('[linkedin] Fetching org details from:', orgsUrl);

      const orgsResponse = await fetch(orgsUrl, { headers });
      console.log('[linkedin] Org batch response status:', orgsResponse.status);
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        const results = orgsData?.results || {};
        for (const orgId of idsList) {
          const orgData = results[orgId];
          if (!orgData) continue;
          organizations.push({
            organizationId: orgId,
            name: orgData.localizedName || orgData.name?.localized?.en_US || 'Unknown Organization',
            logoUrl: undefined
          });
        }
      } else {
        console.warn('[linkedin] Failed to fetch org batch details:', orgsResponse.status);
      }
    } catch (error) {
      console.warn('[linkedin] Error fetching org batch details:', error);
    }

    if (!organizations.length) {
      for (const orgId of orgIds) {
        try {
          const orgUrl = `${config.apiUrl}/organizations/${orgId}`;
          const orgResponse = await fetch(orgUrl, { headers });
          if (!orgResponse.ok) {
            console.warn(`[linkedin] Failed to fetch org ${orgId}:`, orgResponse.status);
            continue;
          }
          const orgData = await orgResponse.json();
          organizations.push({
            organizationId: orgId,
            name: orgData.localizedName || orgData.name?.localized?.en_US || 'Unknown Organization',
            logoUrl: undefined
          });
        } catch (error) {
          console.warn(`[linkedin] Error fetching org ${orgId}:`, error);
        }
      }
    }

    console.log(`[linkedin] Returning ${organizations.length} organizations`);
    return organizations;
  } catch (error) {
    console.warn('[linkedin] Error fetching organizations:', error);
    throw error instanceof Error ? error : new Error('LinkedIn organization lookup failed');
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
