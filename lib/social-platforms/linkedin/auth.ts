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
    const orgIds = new Set<string>();

    // Step 1: Use dmaOrganizationAcls (DMA endpoint for org discovery)
    // GET /rest/dmaOrganizationAcls?q=roleAssignee&role=(value:ADMINISTRATOR)&state=(value:APPROVED)
    const aclsUrl = `${config.apiUrl}/dmaOrganizationAcls?q=roleAssignee&role=(value:ADMINISTRATOR)&state=(value:APPROVED)&start=0&count=100`;
    console.log('[linkedin] Fetching dmaOrganizationAcls:', aclsUrl);

    const aclsResponse = await fetch(aclsUrl, { headers });
    console.log('[linkedin] dmaOrganizationAcls status:', aclsResponse.status);

    if (aclsResponse.ok) {
      const aclsData = await aclsResponse.json();
      console.log('[linkedin] dmaOrganizationAcls response:', JSON.stringify(aclsData, null, 2));

      for (const element of aclsData.elements || []) {
        // Extract org URN from key.organization
        const orgUrn = element?.key?.organization;
        if (orgUrn) {
          const orgId = String(orgUrn).replace('urn:li:organization:', '');
          if (orgId && orgId !== 'undefined') {
            orgIds.add(orgId);
          }
        }
      }
    } else {
      const errorBody = await aclsResponse.text();
      console.warn('[linkedin] dmaOrganizationAcls failed:', aclsResponse.status, errorBody);
    }

    // Fallback: use LINKEDIN_ORGANIZATION_ID env var
    if (orgIds.size === 0) {
      const envOrgId = process.env.LINKEDIN_ORGANIZATION_ID;
      if (envOrgId) {
        console.log('[linkedin] Fallback: using LINKEDIN_ORGANIZATION_ID env var:', envOrgId);
        for (const id of envOrgId.split(',')) {
          const trimmed = id.trim();
          if (trimmed) orgIds.add(trimmed);
        }
      }
    }

    console.log('[linkedin] Organization IDs:', Array.from(orgIds));

    if (orgIds.size === 0) {
      console.warn('[linkedin] No organization IDs found');
      return [];
    }

    // Step 3: Fetch organization details via dmaOrganizations (DMA endpoint)
    const organizations: Array<{ organizationId: string; name: string; logoUrl?: string }> = [];

    for (const orgId of orgIds) {
      try {
        // Use dmaOrganizations GET endpoint
        const orgUrl = `${config.apiUrl}/dmaOrganizations/${orgId}`;
        console.log('[linkedin] Fetching org details from:', orgUrl);

        const orgResponse = await fetch(orgUrl, { headers });

        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          // Extract logo from logoV2.cropped.downloadUrl
          let logoUrl: string | undefined;
          const logoV2 = orgData.logoV2;
          if (logoV2?.cropped?.downloadUrl && logoV2.cropped.status === 'AVAILABLE') {
            logoUrl = logoV2.cropped.downloadUrl;
          }
          organizations.push({
            organizationId: orgId,
            name: orgData.localizedName || orgData.name?.localized?.en_US || `Organization ${orgId}`,
            logoUrl,
          });
          continue;
        }

        console.warn(`[linkedin] dmaOrganizations/${orgId} failed:`, orgResponse.status);

        // Fallback: try dmaOrganizationalPageProfiles
        const pageUrn = encodeURIComponent(`urn:li:organizationalPage:${orgId}`);
        const profileUrl = `${config.apiUrl}/dmaOrganizationalPageProfiles/${pageUrn}`;
        const profileResponse = await fetch(profileUrl, { headers });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          let logoUrl: string | undefined;
          const logoAsset = profileData.logo?.digitalmediaAsset;
          if (logoAsset?.downloadUrl && logoAsset?.status === 'AVAILABLE') {
            logoUrl = logoAsset.downloadUrl;
          }
          organizations.push({
            organizationId: orgId,
            name: profileData.localizedName || profileData.name?.localized?.en_US || `Organization ${orgId}`,
            logoUrl,
          });
        } else {
          // Add with fallback name so the user can still select it
          console.warn(`[linkedin] All org lookups failed for ${orgId}, using fallback name`);
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
    console.error('  4. Configurez LINKEDIN_ORGANIZATION_ID dans les variables d\'environnement');
    throw new Error(
      "Aucune page LinkedIn administrée n'a été trouvée pour ce compte."
    );
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
