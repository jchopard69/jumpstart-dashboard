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
 * Uses organizationAuthorizations batch finder (bq=authorizationActionsAndImpersonator)
 * then dmaOrganizationalPageProfiles for org details.
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-authorizations
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
    // Step 1: Discover organizations via organizationAuthorizations batch finder
    // This is the method recommended by LinkedIn DMA docs for discovering admin pages
    const orgIds = new Set<string>();

    // Try organizationAuthorizations batch finder (works with DMA scope)
    const authActions = 'List(' +
      '(authorizationAction:(organizationAnalyticsAuthorizationAction:(actionType:VISITOR_ANALYTICS_READ))),' +
      '(authorizationAction:(organizationAnalyticsAuthorizationAction:(actionType:FOLLOWER_ANALYTICS_READ)))' +
      ')';
    const authUrl = `${config.apiUrl}/organizationAuthorizations?bq=authorizationActionsAndImpersonator&authorizationActions=${authActions}`;
    console.log('[linkedin] Fetching organization authorizations from:', authUrl);

    const authResponse = await fetch(authUrl, { headers });
    console.log('[linkedin] Organization authorizations response status:', authResponse.status);

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('[linkedin] Organization authorizations response:', JSON.stringify(authData, null, 2));

      // Response structure: { elements: [ { elements: [ { organization: "urn:li:organization:XXX", status: {...} } ] } ] }
      const outerElements = authData.elements || [];
      for (const outerElement of outerElements) {
        const innerElements = outerElement.elements || [];
        for (const element of innerElements) {
          // Only include approved organizations
          const status = element?.status;
          const isApproved = status && (
            status['com.linkedin.organization.Approved'] !== undefined ||
            status.Approved !== undefined
          );
          if (!isApproved && status) {
            console.log('[linkedin] Skipping org with status:', JSON.stringify(status));
            continue;
          }

          const orgUrn = element?.organization;
          if (orgUrn) {
            const orgId = String(orgUrn).replace('urn:li:organization:', '');
            if (orgId && orgId !== 'undefined') {
              orgIds.add(orgId);
            }
          }
        }
      }
    } else {
      console.warn('[linkedin] organizationAuthorizations failed:', authResponse.status);
      const errorBody = await authResponse.text();
      console.warn('[linkedin] Error body:', errorBody);
    }

    // Fallback: try organizationAcls if organizationAuthorizations didn't work
    if (orgIds.size === 0) {
      console.log('[linkedin] Trying organizationAcls fallback...');
      const aclsUrl = `${config.apiUrl}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&start=0&count=100`;
      const aclsResponse = await fetch(aclsUrl, { headers });
      console.log('[linkedin] organizationAcls response status:', aclsResponse.status);

      if (aclsResponse.ok) {
        const aclsData = await aclsResponse.json();
        const elements = aclsData.elements || [];
        for (const element of elements) {
          const orgUrn = element?.organizationTarget || element?.organization || element?.key?.organization;
          if (orgUrn) {
            const orgId = String(orgUrn).replace('urn:li:organization:', '');
            if (orgId && orgId !== 'undefined') {
              orgIds.add(orgId);
            }
          }
        }
      }
    }

    console.log('[linkedin] Discovered organization IDs:', Array.from(orgIds));

    if (orgIds.size === 0) {
      console.warn('[linkedin] No organization IDs found');
      return [];
    }

    // Step 2: Fetch organization details via dmaOrganizationalPageProfiles
    const organizations: Array<{ organizationId: string; name: string; logoUrl?: string }> = [];

    for (const orgId of orgIds) {
      try {
        // Use pageEntity finder to get org page profile from organization URN
        const orgUrn = encodeURIComponent(`urn:li:organization:${orgId}`);
        const profileUrl = `${config.apiUrl}/dmaOrganizationalPageProfiles?q=pageEntity&pageEntity=(organization:${orgUrn})`;
        console.log('[linkedin] Fetching page profile for org:', orgId);

        const profileResponse = await fetch(profileUrl, { headers });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const pageElements = profileData.elements || [];
          if (pageElements.length > 0) {
            const page = pageElements[0];
            // Extract logo URL from the artifacts
            let logoUrl: string | undefined;
            const logoAsset = page.logo?.digitalmediaAsset;
            if (logoAsset?.downloadUrl && logoAsset?.status === 'AVAILABLE') {
              logoUrl = logoAsset.downloadUrl;
            }
            organizations.push({
              organizationId: orgId,
              name: page.localizedName || page.name?.localized?.en_US || `Organization ${orgId}`,
              logoUrl,
            });
            continue;
          }
        }

        // Fallback: try direct page profile GET
        const pageUrn = encodeURIComponent(`urn:li:organizationalPage:${orgId}`);
        const directUrl = `${config.apiUrl}/dmaOrganizationalPageProfiles/${pageUrn}`;
        const directResponse = await fetch(directUrl, { headers });

        if (directResponse.ok) {
          const orgData = await directResponse.json();
          let logoUrl: string | undefined;
          const logoAsset = orgData.logo?.digitalmediaAsset;
          if (logoAsset?.downloadUrl && logoAsset?.status === 'AVAILABLE') {
            logoUrl = logoAsset.downloadUrl;
          }
          organizations.push({
            organizationId: orgId,
            name: orgData.localizedName || orgData.name?.localized?.en_US || `Organization ${orgId}`,
            logoUrl,
          });
        } else {
          console.warn(`[linkedin] Failed to fetch page profile for org ${orgId}:`, directResponse.status);
          // Still add the org with a fallback name so the user can select it
          organizations.push({
            organizationId: orgId,
            name: `Organization ${orgId}`,
            logoUrl: undefined,
          });
        }
      } catch (error) {
        console.warn(`[linkedin] Error fetching org ${orgId}:`, error);
        organizations.push({
          organizationId: orgId,
          name: `Organization ${orgId}`,
          logoUrl: undefined,
        });
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
