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
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<Array<{
  organizationId: string;
  organizationalPageId: string;
  name: string;
  logoUrl?: string;
}>> {
  const config = getLinkedInConfig();

  try {
    const authUrl = `${config.apiUrl}/dmaOrganizationAuthorizations` +
      `?bq=authorizationActionsAndImpersonator` +
      `&authorizationActions=List((authorizationAction:(organizationAnalyticsAuthorizationAction:(actionType:UPDATE_ANALYTICS_READ))))` +
      `&start=0&count=100`;

    const authResponse = await fetch(authUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202402',
      },
    });

    const authData = await authResponse.json();
    console.log('[linkedin] Auth response status:', authResponse.status);
    console.log('[linkedin] Auth data structure:', JSON.stringify(authData, null, 2));

    if (authData.error) {
      console.warn('[linkedin] Failed to fetch organization authorizations:', authData.error);
      return [];
    }

    const authElementsRaw = Array.isArray(authData.elements) ? authData.elements : [];
    console.log('[linkedin] Raw auth elements count:', authElementsRaw.length);

    const authElementsNested = authElementsRaw.flatMap((entry: Record<string, unknown>) => {
      const inner = entry.elements as Array<Record<string, unknown>> | undefined;
      return inner ?? [];
    });
    const authElements = authElementsNested.length ? authElementsNested : authElementsRaw;
    console.log('[linkedin] Final auth elements count:', authElements.length);

    const orgIds = Array.from(new Set(authElements
      .filter((element: Record<string, unknown>) => {
        const status = element.status as Record<string, unknown> | undefined;
        const isApproved = !!status?.approved;
        console.log('[linkedin] Element approval status:', { element, status, isApproved });
        return isApproved;
      })
      .map((element: Record<string, unknown>) => String(element.organization || ''))
      .filter(Boolean)
      .map((urn: string) => urn.replace('urn:li:organization:', ''))
      .filter((value: string) => value && value !== 'undefined')
    ));

    console.log('[linkedin] Extracted org IDs:', orgIds);

    if (!orgIds.length) {
      console.warn('[linkedin] No approved organizations found. Full response:', JSON.stringify(authData, null, 2));
      return [];
    }

    const orgsUrl = `${config.apiUrl}/dmaOrganizations?ids=List(${orgIds.join(',')})`;
    const orgsResponse = await fetch(orgsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202402',
      },
    });
    const orgsData = await orgsResponse.json();

    if (orgsData.error) {
      console.warn('[linkedin] Failed to fetch organizations details:', orgsData.error);
      return [];
    }

    const results = orgsData.results as Record<string, Record<string, unknown>> | undefined;
    if (!results) {
      return [];
    }

    const organizations = Object.entries(results)
      .map(([orgId, org]) => {
        const pageUrn = org.organizationalPage as string | undefined;
        const pageId = pageUrn?.replace('urn:li:organizationalPage:', '');
        const localizedName = org.localizedName as string | undefined;
        const logoV2 = org.logoV2 as Record<string, unknown> | undefined;
        const cropped = logoV2?.cropped as Record<string, unknown> | undefined;
        const logoUrl = (cropped?.downloadUrl as string | undefined) ||
          (logoV2?.original as Record<string, unknown> | undefined)?.downloadUrl as string | undefined;

        if (!pageId) return null;

        return {
          organizationId: orgId,
          organizationalPageId: pageId,
          name: localizedName || 'Unknown Organization',
          logoUrl,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

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
        organizationalPageId: org.organizationalPageId,
      },
    });
  }

  return { tenantId, accounts };
}
