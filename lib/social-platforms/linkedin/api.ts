/**
 * LinkedIn Pages Data Portability API (DMA) connector for analytics
 *
 * Uses the DMA endpoints (r_dma_admin_pages_content scope) instead of
 * Community Management API which requires separate approval.
 *
 * Endpoints used:
 * - /dmaOrganizationalPageEdgeAnalytics (follower/visitor trends)
 * - /dmaOrganizationalPageContentAnalytics (post-level & page-level content analytics)
 * - /dmaPosts (fetch post details)
 * - /dmaFeedContentsExternal (list posts by author)
 * - /dmaSocialMetadata (reaction/comment counts per post)
 */

import { LINKEDIN_CONFIG, getLinkedInVersion } from './config';
import { apiRequest, SocialApiError } from '../core/api-client';
import type { Connector } from '@/lib/connectors/types';
import type { DailyMetric, PostMetric } from '../core/types';

const API_REST_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();

const MAX_POSTS_SYNC = 50;
const MAX_POST_METRICS_SYNC = 15;
const ENABLE_PUBLIC_FOLLOWER_FALLBACK = (process.env.LINKEDIN_ENABLE_PUBLIC_FOLLOWER_FALLBACK ?? '1') !== '0';

// ── Types ──────────────────────────────────────────────────────────────

type NumericCount = {
  long?: number | string;
  bigDecimal?: number | string;
};

type FollowerEdgeAnalyticsValue = {
  organicValue?: number | NumericCount;
  sponsoredValue?: number | NumericCount;
  organicFollowerGain?: number | NumericCount;
  sponsoredFollowerGain?: number | NumericCount;
};

type EdgeAnalyticsValue = {
  totalCount?: NumericCount;
  typeSpecificValue?: {
    followerEdgeAnalyticsValue?: FollowerEdgeAnalyticsValue;
    visitorEdgeAnalyticsValue?: {
      desktopCount?: number;
      mobileCount?: number;
      uniqueCount?: number;
    };
  };
};

type EdgeAnalyticsElement = {
  type?: string; // FOLLOWER | VISITOR
  value?: EdgeAnalyticsValue;
  metric?: {
    timeIntervals?: {
      timeRange?: { start?: number; end?: number };
    };
    value?: EdgeAnalyticsValue;
  };
  timeIntervals?: {
    timeRange?: { start?: number; end?: number };
  };
};

type ContentAnalyticsValue = {
  totalCount?: NumericCount;
  typeSpecificValue?: {
    contentAnalyticsValue?: {
      organicValue?: NumericCount;
      sponsoredValue?: NumericCount;
    };
  };
};

type ContentAnalyticsElement = {
  type: string; // IMPRESSIONS | UNIQUE_IMPRESSIONS | CLICKS | COMMENTS | REACTIONS | REPOSTS
  metric?: {
    timeIntervals?: { timeRange?: { start?: number; end?: number } };
    value?: ContentAnalyticsValue;
  };
  timeIntervals?: { timeRange?: { start?: number; end?: number } };
  value?: ContentAnalyticsValue;
  sourceEntity?: string;
};


type DmaPostElement = {
  id?: string;
  author?: string;
  commentary?: string;
  content?: Record<string, unknown>;
  created?: { actor?: string; time?: number };
  lastModified?: { actor?: string; time?: number };
  publishedAt?: number;
  lifecycleState?: string;
  visibility?: string;
  distribution?: Record<string, unknown>;
  socialDetail?: {
    totalShareStatistics?: {
      shareCount?: number;
      likeCount?: number;
      commentCount?: number;
      impressionCount?: number;
      uniqueImpressionCount?: number;
      clickCount?: number;
    };
  };
  // Legacy fields kept for compat
  createdAt?: number;
};

type FeedContentsElement = {
  id?: string;
  // Legacy field name
  contentUrn?: string;
  type?: string;
};

type SocialMetadataResponse = {
  reactionSummary?: { totalCount?: number };
  commentSummary?: { totalCount?: number };
  shareCount?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Determine the media_type from a DMA post's content field.
 * Maps LinkedIn content types to normalized format names used by insights.
 */
export function detectLinkedInMediaType(content?: Record<string, unknown>): string {
  if (!content) return 'text';
  if (content.carousel) return 'carousel';
  if (content.multiImage) return 'carousel';
  if (content.poll) return 'text';
  if (content.article) return 'link';
  if (content.celebration) return 'image';
  if (content.media) {
    const media = content.media as Record<string, unknown>;
    if (media.video) return 'video';
    if (media.document) return 'link';
    // image by default for media content
    return 'image';
  }
  return 'text';
}

export function buildHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': API_VERSION,
  };
}

export function normalizeOrganizationId(value: string): string {
  return value
    .replace('urn:li:organization:', '')
    .replace('urn:li:organizationalPage:', '');
}

function normalizePostUrn(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  let decoded = trimmed;
  try {
    const once = decodeURIComponent(decoded);
    if (once) decoded = once;
  } catch {
    // keep original
  }
  return decoded;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (cleaned && cleaned !== '-' && cleaned !== '.' && cleaned !== '-.') {
      const parsedClean = Number(cleaned);
      if (Number.isFinite(parsedClean)) return parsedClean;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const longValue = record.long;
    if (typeof longValue === 'number' && Number.isFinite(longValue)) return longValue;
    if (typeof longValue === 'string' && longValue.trim().length > 0) {
      const parsedLong = Number(longValue);
      if (Number.isFinite(parsedLong)) return parsedLong;
    }
    const decimalValue = record.bigDecimal;
    if (typeof decimalValue === 'number' && Number.isFinite(decimalValue)) return decimalValue;
    if (typeof decimalValue === 'string' && decimalValue.trim().length > 0) {
      const parsedDecimal = Number(decimalValue);
      if (Number.isFinite(parsedDecimal)) return parsedDecimal;
    }
  }
  return 0;
}

function parseLooseCount(value: string): number {
  const normalized = value
    .toLowerCase()
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!normalized) return 0;

  const compact = normalized.replace(/\s+/g, '');
  const suffixMatch = compact.match(/^(\d+(?:[.,]\d+)?)([kmb])$/i);
  if (suffixMatch) {
    const base = Number(suffixMatch[1].replace(',', '.'));
    if (Number.isFinite(base) && base > 0) {
      const multiplier = suffixMatch[2].toLowerCase() === 'k'
        ? 1_000
        : suffixMatch[2].toLowerCase() === 'm'
          ? 1_000_000
          : 1_000_000_000;
      return Math.round(base * multiplier);
    }
  }

  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) {
    const parsedGrouped = Number(compact.replace(/[.,]/g, ''));
    if (Number.isFinite(parsedGrouped) && parsedGrouped > 0) return parsedGrouped;
  }

  const parsedAsNumber = Number(compact.replace(',', '.'));
  if (Number.isFinite(parsedAsNumber) && parsedAsNumber > 0) {
    return Math.round(parsedAsNumber);
  }

  const digits = compact.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsedDigits = Number(digits);
  return Number.isFinite(parsedDigits) ? parsedDigits : 0;
}

function parseFollowerOverrides(raw: string): Map<string, number> {
  const output = new Map<string, number>();
  if (!raw.trim()) return output;

  for (const token of raw.split(/[\n;]+/)) {
    const entry = token.trim();
    if (!entry) continue;

    const parts = entry.includes('=') ? entry.split('=') : entry.split(':');
    if (parts.length !== 2) continue;

    const key = parts[0].trim();
    const value = parseLooseCount(parts[1] ?? '');
    if (!key || value <= 0) continue;

    output.set(key, value);
  }

  return output;
}

function getFollowerOverride(keys: string[]): number {
  const overrideMap = parseFollowerOverrides(process.env.LINKEDIN_FOLLOWER_OVERRIDES ?? '');
  if (!overrideMap.size) return 0;

  for (const key of keys) {
    const candidate = overrideMap.get(key);
    if (candidate && candidate > 0) {
      return candidate;
    }
  }

  return 0;
}

function getFollowerCandidatesFromPublicHtml(html: string): number[] {
  const candidates: number[] = [];

  const jsonFollowerRegex = /"followerCount"\s*:\s*(\d{1,12})/gi;
  let jsonMatch: RegExpExecArray | null = null;
  while ((jsonMatch = jsonFollowerRegex.exec(html)) !== null) {
    const parsed = Number(jsonMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) candidates.push(parsed);
  }

  const localizedRegex = /([\d\s.,\u202f]{1,20}[kmb]?)\s*(?:followers?|abonn[ée]s?)/gi;
  let localizedMatch: RegExpExecArray | null = null;
  while ((localizedMatch = localizedRegex.exec(html)) !== null) {
    const parsed = parseLooseCount(localizedMatch[1] ?? '');
    if (parsed > 0) candidates.push(parsed);
  }

  return candidates.filter((value) => value >= 2 && value < 1_000_000_000);
}

async function fetchPublicFollowerCount(vanityName: string | undefined, organizationId: string): Promise<number> {
  if (!ENABLE_PUBLIC_FOLLOWER_FALLBACK) return 0;

  const pathCandidates = [
    vanityName?.trim(),
    organizationId.trim(),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const path of pathCandidates) {
    const url = `https://www.linkedin.com/company/${encodeURIComponent(path)}/`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JumpstartDashboardBot/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) continue;

      const html = await response.text();
      const candidates = getFollowerCandidatesFromPublicHtml(html);
      const best = candidates.length > 0 ? Math.max(...candidates) : 0;
      if (best > 0) {
        console.log(`[linkedin-dma] Public page follower fallback matched ${best} (path=${path})`);
        return best;
      }
    } catch {
      // silent
    }
  }

  return 0;
}

function getNestedValue(input: unknown, path: string[]): unknown {
  let current: unknown = input;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function getFirstNumber(input: unknown, paths: string[][]): number {
  for (const path of paths) {
    const value = toNumber(getNestedValue(input, path));
    if (value !== 0) return value;
  }
  return 0;
}

function getEdgeElementValue(element: EdgeAnalyticsElement): EdgeAnalyticsValue | undefined {
  return element.value ?? element.metric?.value;
}

function getEdgeRangeStartMs(element: EdgeAnalyticsElement): number | null {
  const rawStart = element.timeIntervals?.timeRange?.start ?? element.metric?.timeIntervals?.timeRange?.start;
  const start = toNumber(rawStart);
  if (start <= 0) return null;
  return normalizeLinkedInTimestampMs(start);
}

function getFollowerTotal(value: EdgeAnalyticsValue | undefined): number {
  const organicCount = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicFollowerCount'],
  ]);
  const sponsoredCount = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredFollowerCount'],
  ]);
  const summedBreakdown = organicCount + sponsoredCount;

  return Math.max(
    toNumber(value?.totalCount),
    getFirstNumber(value, [
      ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'totalCount'],
    ]),
    summedBreakdown
  );
}

function getFollowerGains(value: EdgeAnalyticsValue | undefined): number {
  const organic = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicValue'],
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'organicFollowerGain'],
  ]);
  const sponsored = getFirstNumber(value, [
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredValue'],
    ['typeSpecificValue', 'followerEdgeAnalyticsValue', 'sponsoredFollowerGain'],
  ]);
  return organic + sponsored;
}

export function normalizeLinkedInTimestampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  // Some LinkedIn payloads provide epoch seconds, others epoch milliseconds.
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function toLinkedInIsoDate(value?: number): string {
  if (!value || !Number.isFinite(value)) return new Date().toISOString();
  return new Date(normalizeLinkedInTimestampMs(value)).toISOString();
}

export function parseFollowerTrendElements(elements?: EdgeAnalyticsElement[]): { daily: Record<string, number>; totalFollowers: number } {
  const rows: Array<{ startMs: number; dateKey: string; total: number; explicitGain: number }> = [];

  for (const element of elements ?? []) {
    const rangeStart = getEdgeRangeStartMs(element);
    if (!rangeStart) continue;

    const value = getEdgeElementValue(element);
    const total = getFollowerTotal(value);
    const explicitGain = getFollowerGains(value);
    const dateKey = new Date(rangeStart).toISOString().slice(0, 10);
    rows.push({ startMs: rangeStart, dateKey, total, explicitGain });
  }

  rows.sort((a, b) => a.startMs - b.startMs);

  const daily: Record<string, number> = {};
  let totalFollowers = 0;
  let previousTotal: number | null = null;

  for (const row of rows) {
    totalFollowers = Math.max(totalFollowers, row.total);

    let gain = row.explicitGain;
    // Some payload variants omit daily gains but include cumulative totals.
    if (gain === 0 && row.total > 0 && previousTotal != null && row.total >= previousTotal) {
      gain = row.total - previousTotal;
    }

    daily[row.dateKey] = (daily[row.dateKey] ?? 0) + gain;

    if (row.total > 0) {
      previousTotal = row.total;
    }
  }

  return { daily, totalFollowers };
}

function getMetricTotalCount(element: ContentAnalyticsElement): number {
  const value = element.metric?.value ?? element.value;
  const totalCount = toNumber(value?.totalCount);
  if (totalCount > 0) return totalCount;
  // Also try organic + sponsored
  const cv = value?.typeSpecificValue?.contentAnalyticsValue;
  return toNumber(cv?.organicValue) + toNumber(cv?.sponsoredValue);
}

function collectFollowerLikeNumbers(input: unknown, path: string[] = [], results: number[] = []): number[] {
  if (input == null) return results;

  if (typeof input === 'number' || typeof input === 'string') {
    const value = toNumber(input);
    if (value <= 0) return results;

    const pathJoined = path.join('.').toLowerCase();
    if (
      pathJoined.includes('follower') ||
      pathJoined.includes('subscriber') ||
      pathJoined.includes('firstdegreesize') ||
      pathJoined.includes('networksize')
    ) {
      results.push(value);
    }
    return results;
  }

  if (typeof input !== 'object') return results;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    collectFollowerLikeNumbers(value, [...path, key], results);
  }

  return results;
}

function getPostStatsSignalCount(post?: DmaPostElement): number {
  if (!post) return 0;

  const keywordSignals = new Set<string>();
  const walk = (input: unknown, path: string[] = []) => {
    if (input == null) return;
    if (typeof input === 'number' || typeof input === 'string') {
      const value = toNumber(input);
      if (value <= 0) return;

      const joined = path.join('.').toLowerCase();
      if (joined.includes('impression') || joined.includes('view')) keywordSignals.add('visibility');
      if (joined.includes('unique') || joined.includes('reach')) keywordSignals.add('reach');
      if (joined.includes('click')) keywordSignals.add('clicks');
      if (joined.includes('reaction') || joined.includes('like')) keywordSignals.add('reactions');
      if (joined.includes('comment')) keywordSignals.add('comments');
      if (joined.includes('repost') || joined.includes('share')) keywordSignals.add('shares');
      return;
    }

    if (typeof input !== 'object') return;

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      walk(value, [...path, key]);
    }
  };

  walk(post);

  const stats = post.socialDetail?.totalShareStatistics;
  let score = keywordSignals.size;
  if (stats) {
    if (stats.impressionCount !== undefined) score++;
    if (stats.uniqueImpressionCount !== undefined) score++;
    if (stats.clickCount !== undefined) score++;
    if (stats.likeCount !== undefined) score++;
    if (stats.commentCount !== undefined) score++;
    if (stats.shareCount !== undefined) score++;
  }
  return score;
}

// ── API Functions ──────────────────────────────────────────────────────

/**
 * Resolve organization ID to organizationalPage URN via DMA Page Profiles.
 * LinkedIn docs say: "convert it to an organizationalPage using the
 * OrganizationalPage pageEntity finder". The page URN may differ from org ID.
 */
export async function resolveOrganizationalPageUrn(
  headers: Record<string, string>,
  organizationId: string
): Promise<string> {
  const orgUrn = `urn:li:organization:${organizationId}`;
  const defaultPageUrn = `urn:li:organizationalPage:${organizationId}`;

  try {
    const url = `${API_REST_URL}/dmaOrganizationalPageProfiles` +
      `?q=pageEntity` +
      `&pageEntity=(organization:${encodeURIComponent(orgUrn)})`;

    const response = await apiRequest<{
      elements?: Array<{
        entityUrn?: string;
        primaryPageEntity?: { organization?: string };
      }>;
    }>('linkedin', url, { headers }, 'linkedin_dma_page_resolve', true);

    const resolved = response.elements?.[0]?.entityUrn;
    if (resolved) {
      console.log(`[linkedin-dma] Resolved page URN: ${resolved} (org=${orgUrn})`);
      return resolved;
    }
  } catch {
    // Fallback to default
  }

  console.log(`[linkedin-dma] Using default page URN: ${defaultPageUrn}`);
  return defaultPageUrn;
}

/**
 * Fetch follower trend (daily gains) via DMA Edge Analytics
 */
export async function fetchFollowerTrend(
  headers: Record<string, string>,
  organizationId: string,
  start: Date,
  end: Date,
  pageUrn?: string
): Promise<{ daily: Record<string, number>; totalFollowers: number }> {
  if (!pageUrn) pageUrn = `urn:li:organizationalPage:${organizationId}`;
  const startMs = start.getTime();
  const endMs = end.getTime();

  const url = `${API_REST_URL}/dmaOrganizationalPageEdgeAnalytics` +
    `?q=trend` +
    `&organizationalPage=${encodeURIComponent(pageUrn)}` +
    `&analyticsType=FOLLOWER` +
    `&timeIntervals=(timeRange:(start:${startMs},end:${endMs}))`;

  const response = await apiRequest<{ elements?: EdgeAnalyticsElement[] }>(
    'linkedin', url, { headers }, 'linkedin_dma_follower_trend'
  );

  console.log(`[linkedin-dma] EdgeAnalytics FOLLOWER: ${response.elements?.length ?? 0} elements`);
  const parsed = parseFollowerTrendElements(response.elements);
  if (parsed.totalFollowers === 0 && (response.elements?.length ?? 0) > 0) {
    const sample = JSON.stringify(response.elements?.[0] ?? {}).slice(0, 800);
    console.log(`[linkedin-dma] EdgeAnalytics sample element (totalFollowers=0): ${sample}`);
  }
  return parsed;
}

/**
 * Fetch total follower count using a cascade of strategies:
 *
 * 0. Optional env override (LINKEDIN_FOLLOWER_OVERRIDES).
 * 1. organizationalEntityFollowerStatistics (REST API) — gives exact total
 *    but requires r_organization_social scope.
 * 2. networkSizes (v2 API) — lightweight, gives firstDegreeSize.
 * 3. dmaOrganizations/{orgId} (DMA) — some payloads expose follower-like fields.
 * 4. dmaOrganizationalPageProfiles (DMA) — fallback for follower-like fields.
 * 5. Public company page HTML fallback (if enabled).
 * 6. dmaOrganizationalPageFollows first-page total (DMA).
 *
 * Each method is tried silently; first success wins.
 */
export async function fetchFollowerCount(
  headers: Record<string, string>,
  organizationId: string,
  resolvedPageUrn?: string
): Promise<number> {
  const orgUrn = `urn:li:organization:${organizationId}`;
  const pageUrn = resolvedPageUrn ?? `urn:li:organizationalPage:${organizationId}`;
  let pageVanityName: string | undefined;

  const override = getFollowerOverride([
    organizationId,
    orgUrn,
    pageUrn,
  ]);
  if (override > 0) {
    console.log(`[linkedin-dma] Follower override applied for org=${organizationId}: ${override}`);
    return override;
  }

  // Strategy 1: organizationalEntityFollowerStatistics (REST)
  try {
    const url = `${API_REST_URL}/organizationalEntityFollowerStatistics` +
      `?q=organizationalEntity` +
      `&organizationalEntity=${encodeURIComponent(orgUrn)}`;

    const response = await apiRequest<{
      elements?: Array<{
        followerCounts?: {
          organicFollowerCount?: number;
          paidFollowerCount?: number;
        };
      }>;
    }>('linkedin', url, { headers }, 'linkedin_follower_stats', true);

    const counts = response.elements?.[0]?.followerCounts;
    if (counts) {
      const total = (counts.organicFollowerCount ?? 0) + (counts.paidFollowerCount ?? 0);
      console.log(`[linkedin-dma] followerStatistics: organic=${counts.organicFollowerCount}, paid=${counts.paidFollowerCount}, total=${total}`);
      if (total > 0) return total;
    }
  } catch {
    console.log('[linkedin-dma] organizationalEntityFollowerStatistics not available (likely missing scope)');
  }

  // Strategy 2: networkSizes (v2)
  try {
    const v2Url = `${LINKEDIN_CONFIG.apiV2Url}/networkSizes/${encodeURIComponent(orgUrn)}` +
      `?edgeType=CompanyFollowedByMember`;

    const response = await apiRequest<{
      firstDegreeSize?: number;
    }>('linkedin', v2Url, { headers }, 'linkedin_network_sizes', true);

    if (response.firstDegreeSize && response.firstDegreeSize > 0) {
      console.log(`[linkedin-dma] networkSizes: firstDegreeSize=${response.firstDegreeSize}`);
      return response.firstDegreeSize;
    }
  } catch {
    console.log('[linkedin-dma] networkSizes not available (likely missing scope)');
  }

  // Strategy 3: dmaOrganizations/{orgId} (DMA)
  try {
    const orgDetailUrl = `${API_REST_URL}/dmaOrganizations/${encodeURIComponent(organizationId)}`;
    const orgDetail = await apiRequest<Record<string, unknown>>(
      'linkedin',
      orgDetailUrl,
      { headers },
      'linkedin_dma_org_detail',
      true
    );

    if (typeof orgDetail.vanityName === 'string' && orgDetail.vanityName.trim().length > 0) {
      pageVanityName = orgDetail.vanityName.trim();
    }

    const orgCandidates = collectFollowerLikeNumbers(orgDetail);
    const bestOrgCandidate = orgCandidates.length > 0 ? Math.max(...orgCandidates) : 0;
    if (bestOrgCandidate > 0) {
      console.log(`[linkedin-dma] dmaOrganizations follower candidate: ${bestOrgCandidate}`);
      return bestOrgCandidate;
    }
  } catch {
    // silent
  }

  // Strategy 4: dmaOrganizationalPageProfiles (DMA).
  // Some tenants expose follower-like counts in profile payload fields.
  try {
    const profileFinderUrl = `${API_REST_URL}/dmaOrganizationalPageProfiles` +
      `?q=pageEntity` +
      `&pageEntity=(organization:${encodeURIComponent(orgUrn)})`;

    const finderResponse = await apiRequest<{
      elements?: Array<Record<string, unknown>>;
    }>('linkedin', profileFinderUrl, { headers }, 'linkedin_dma_page_profiles', true);

    const detailUrl = `${API_REST_URL}/dmaOrganizationalPageProfiles/${encodeURIComponent(pageUrn)}`;
    const detailResponse = await apiRequest<Record<string, unknown>>(
      'linkedin',
      detailUrl,
      { headers },
      'linkedin_dma_page_profile_detail',
      true
    );

    const profileVanity = detailResponse.vanityName;
    if (typeof profileVanity === 'string' && profileVanity.trim().length > 0) {
      pageVanityName = profileVanity.trim();
    }

    const candidates = collectFollowerLikeNumbers([
      ...(finderResponse.elements ?? []),
      detailResponse
    ]);
    const best = candidates.length > 0 ? Math.max(...candidates) : 0;
    if (best > 0) {
      console.log(`[linkedin-dma] pageProfiles follower candidate: ${best}`);
      return best;
    }

    const sampleFinder = JSON.stringify(finderResponse.elements?.[0] ?? {}).slice(0, 600);
    const sampleDetail = JSON.stringify(detailResponse ?? {}).slice(0, 600);
    console.log(`[linkedin-dma] pageProfiles sample (no follower candidate): finder=${sampleFinder}`);
    console.log(`[linkedin-dma] pageProfile detail sample (no follower candidate): detail=${sampleDetail}`);
  } catch {
    // silent
  }

  const overrideWithVanity = getFollowerOverride([
    organizationId,
    orgUrn,
    pageUrn,
    pageVanityName ?? '',
  ]);
  if (overrideWithVanity > 0) {
    console.log(`[linkedin-dma] Follower override applied for org=${organizationId} vanity=${pageVanityName ?? 'n/a'}: ${overrideWithVanity}`);
    return overrideWithVanity;
  }

  // Strategy 5: Public company page fallback.
  try {
    const publicCount = await fetchPublicFollowerCount(pageVanityName, organizationId);
    if (publicCount > 0) {
      return publicCount;
    }
  } catch {
    // silent
  }

  // Strategy 6: dmaOrganizationalPageFollows with first-page total.
  // Use the resolved organizationalPage URN — the page ID may differ from org ID.
  const PAGE_SIZE = 100;

  try {
    const firstUrl = `${API_REST_URL}/dmaOrganizationalPageFollows` +
      `?q=followee` +
      `&followee=${encodeURIComponent(pageUrn)}` +
      `&edgeType=MEMBER_FOLLOWS_ORGANIZATIONAL_PAGE` +
      `&maxPaginationCount=${PAGE_SIZE}`;

    const response = await apiRequest<{
      paging?: { total?: number };
      metadata?: { nextPaginationCursor?: string | null };
      elements?: unknown[];
    }>('linkedin', firstUrl, { headers }, 'linkedin_dma_follower_count', true);

    const elementsCount = response.elements?.length ?? 0;
    const pagingTotal = response.paging?.total;
    console.log(`[linkedin-dma] DMA followers raw paging: ${JSON.stringify(response.paging)}, metadata: ${JSON.stringify(response.metadata)}, elements: ${elementsCount}`);

    // The endpoint has strict per-minute limits. Prefer paging.total from the
    // first page and avoid high-frequency cursor loops that trigger 429.
    if (pagingTotal != null && pagingTotal > 0) {
      const best = Math.max(pagingTotal, elementsCount);
      console.log(`[linkedin-dma] DMA follower count from first page: ${best} (paging.total=${pagingTotal}, elements=${elementsCount})`);
      return best;
    }

    const hasMore = !!response.metadata?.nextPaginationCursor;
    if (hasMore) {
      console.log('[linkedin-dma] DMA follows has pagination cursor but paging.total is unavailable; skipping extra pages to avoid endpoint throttle.');
    }

    if (elementsCount > 0) {
      console.log(`[linkedin-dma] DMA follower count from first page elements: ${elementsCount}`);
      return elementsCount;
    }
  } catch (error) {
    console.log('[linkedin-dma] DMA follower count failed:', error instanceof Error ? error.message : error);
  }

  console.log(`[linkedin-dma] Could not determine follower count for org=${organizationId}`);
  return 0;
}

/**
 * Fetch page-level content analytics trend (daily impressions, clicks, etc.)
 */
export async function fetchPageContentTrend(
  headers: Record<string, string>,
  organizationId: string,
  start: Date,
  end: Date
): Promise<Map<string, {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  comments: number;
  reactions: number;
  reposts: number;
}>> {
  const pageUrn = `urn:li:organizationalPage:${organizationId}`;
  const startMs = start.getTime();
  const endMs = end.getTime();

  const metrics = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,COMMENTS,REACTIONS,REPOSTS)';
  const url = `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
    `?q=trend` +
    `&sourceEntity=${encodeURIComponent(pageUrn)}` +
    `&metricTypes=${metrics}` +
    `&timeIntervals=(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:DAY)`;

  const response = await apiRequest<{ elements?: ContentAnalyticsElement[] }>(
    'linkedin', url, { headers }, 'linkedin_dma_content_trend'
  );

  const dailyMap = new Map<string, {
    impressions: number;
    uniqueImpressions: number;
    clicks: number;
    comments: number;
    reactions: number;
    reposts: number;
  }>();

  for (const element of response.elements ?? []) {
    const rangeStart = element.metric?.timeIntervals?.timeRange?.start ?? element.timeIntervals?.timeRange?.start;
    if (!rangeStart) continue;

    const dateKey = new Date(rangeStart).toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) ?? {
      impressions: 0, uniqueImpressions: 0, clicks: 0,
      comments: 0, reactions: 0, reposts: 0
    };

    const count = getMetricTotalCount(element);

    switch (element.type) {
      case 'IMPRESSIONS': existing.impressions += count; break;
      case 'UNIQUE_IMPRESSIONS': existing.uniqueImpressions += count; break;
      case 'CLICKS': existing.clicks += count; break;
      case 'COMMENTS': existing.comments += count; break;
      case 'REACTIONS': existing.reactions += count; break;
      case 'REPOSTS': existing.reposts += count; break;
    }

    dailyMap.set(dateKey, existing);
  }

  return dailyMap;
}

/**
 * Fetch list of posts via DMA Feed Contents External
 */
export async function fetchDmaPosts(
  headers: Record<string, string>,
  organizationId: string,
  limit: number
): Promise<string[]> {
  const orgUrn = `urn:li:organization:${organizationId}`;

  // dmaFeedContentsExternal with q=postsByAuthor and author=List(orgUrn)
  const url = `${API_REST_URL}/dmaFeedContentsExternal` +
    `?q=postsByAuthor` +
    `&author=List(${encodeURIComponent(orgUrn)})` +
    `&maxPaginationCount=${limit}`;

  try {
    const response = await apiRequest<{ elements?: FeedContentsElement[] }>(
      'linkedin', url, { headers }, 'linkedin_dma_feed_contents'
    );

    console.log(`[linkedin-dma] dmaFeedContentsExternal returned ${response.elements?.length ?? 0} elements`);

    const urns = (response.elements ?? [])
      .map(e => e.id ?? e.contentUrn)
      .filter((urn): urn is string => !!urn)
      .map((urn) => normalizePostUrn(urn))
      .filter((urn) => urn.startsWith('urn:li:share:') || urn.startsWith('urn:li:ugcPost:'));

    return Array.from(new Set(urns)).slice(0, limit);
  } catch (error) {
    console.log('[linkedin-dma] Failed to fetch feed contents:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Fetch post details via /dmaPosts BATCH_GET
 */
export async function fetchPostDetails(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, DmaPostElement>> {
  const posts = new Map<string, DmaPostElement>();

  if (!postUrns.length) return posts;

  const upsertPost = (urn: string, post: DmaPostElement) => {
    const normalized = normalizePostUrn(urn);
    const existing = posts.get(normalized) ?? posts.get(urn);
    if (!existing || getPostStatsSignalCount(post) >= getPostStatsSignalCount(existing)) {
      posts.set(urn, post);
      posts.set(normalized, post);
    }
  };

  const hasPost = (urn: string) => {
    const normalized = normalizePostUrn(urn);
    return posts.has(urn) || posts.has(normalized);
  };

  const fetchSinglePost = async (urn: string): Promise<DmaPostElement | null> => {
    const encodedUrn = encodeURIComponent(urn);
    const urls = [
      `${API_REST_URL}/dmaPosts/${encodedUrn}?viewContext=AUTHOR`,
      `${API_REST_URL}/dmaPosts/${encodedUrn}?viewContext=READER`,
      `${API_REST_URL}/dmaPosts/${encodedUrn}`,
    ];

    let best: DmaPostElement | null = null;
    let bestScore = -1;

    for (const url of urls) {
      try {
        const post = await apiRequest<DmaPostElement>(
          'linkedin',
          url,
          { headers },
          'linkedin_dma_post_detail',
          true
        );
        const score = getPostStatsSignalCount(post);
        if (!best || score >= bestScore) {
          best = post;
          bestScore = score;
        }
      } catch {
        // try next URL variant
      }
    }

    return best;
  };

  const normalizedUrns = postUrns.map((urn) => normalizePostUrn(urn));
  // BATCH_GET: /dmaPosts?ids=List(encoded_urn1,encoded_urn2,...)&viewContext=AUTHOR
  // Process in chunks of 20 to avoid URL length issues
  const BATCH_SIZE = 20;
  for (let i = 0; i < normalizedUrns.length; i += BATCH_SIZE) {
    const batch = normalizedUrns.slice(i, i + BATCH_SIZE);
    const encodedIds = batch.map((urn) => encodeURIComponent(urn)).join(',');

    let batchSucceeded = false;
    for (const viewContext of ['READER', 'AUTHOR'] as const) {
      const url = `${API_REST_URL}/dmaPosts?ids=List(${encodedIds})&viewContext=${viewContext}`;
      const batchHeaders = {
        ...headers,
        'X-RestLi-Method': 'BATCH_GET',
      };

      try {
        const response = await apiRequest<{
          results?: Record<string, DmaPostElement>;
          statuses?: Record<string, number>;
          errors?: Record<string, unknown>;
        }>('linkedin', url, { headers: batchHeaders }, `linkedin_dma_post_batch_${viewContext.toLowerCase()}`, true);

        const results = response.results ?? {};
        for (const [resultUrn, post] of Object.entries(results)) {
          upsertPost(resultUrn, post);
        }
        if (Object.keys(results).length > 0) {
          batchSucceeded = true;
          // Keep trying AUTHOR after READER to enrich metrics payload.
          if (viewContext === 'AUTHOR') break;
        }
      } catch {
        // Try next viewContext
      }
    }

    const missingUrns = batch.filter((urn) => !hasPost(urn));
    if (missingUrns.length > 0) {
      let recovered = 0;
      for (const urn of missingUrns) {
        const post = await fetchSinglePost(urn);
        if (!post) continue;
        upsertPost(urn, post);
        recovered++;
      }

      if (recovered > 0) {
        console.log(`[linkedin-dma] Post detail fallback recovered ${recovered}/${missingUrns.length} missing posts`);
      } else if (!batchSucceeded) {
        console.log(`[linkedin-dma] Post batch and detail fallback returned no results for ${missingUrns.length} posts`);
      }
    }
  }

  return posts;
}


/**
 * Fetch social metadata (reaction/comment/share counts) for posts.
 * This endpoint can be unavailable with some DMA configurations (404).
 */
export async function fetchSocialMetadata(
  headers: Record<string, string>,
  postUrns: string[]
): Promise<Map<string, { reactions: number; comments: number; reposts: number }>> {
  const metadata = new Map<string, { reactions: number; comments: number; reposts: number }>();
  if (!postUrns.length) return metadata;

  for (let i = 0; i < postUrns.length; i++) {
    const urn = postUrns[i];
    try {
      const encodedUrn = encodeURIComponent(urn);
      const url = `${API_REST_URL}/dmaSocialMetadata/${encodedUrn}`;
      const response = await apiRequest<SocialMetadataResponse>(
        'linkedin',
        url,
        { headers },
        'linkedin_dma_social_metadata',
        true
      );
      metadata.set(urn, {
        reactions: response.reactionSummary?.totalCount ?? 0,
        comments: response.commentSummary?.totalCount ?? 0,
        reposts: response.shareCount ?? 0,
      });
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 404 && i === 0) {
        console.log(`[linkedin-dma] dmaSocialMetadata not available (404), skipping ${postUrns.length} posts`);
        return metadata;
      }
      if (error instanceof SocialApiError && error.statusCode === 429) {
        console.log('[linkedin-dma] dmaSocialMetadata rate-limited, stopping post metadata fetch');
        break;
      }
      // Ignore errors on individual posts.
    }
  }

  return metadata;
}

/**
 * Fetch post-level analytics via dmaOrganizationalPageContentAnalytics.
 * Limited to a small subset to reduce DMA resource throttle pressure.
 */
export async function fetchPostAnalytics(
  headers: Record<string, string>,
  postUrns: string[],
  maxRequests = MAX_POST_METRICS_SYNC
): Promise<Map<string, {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
}>> {
  const analytics = new Map<string, {
    impressions: number;
    uniqueImpressions: number;
    clicks: number;
    reactions: number;
    comments: number;
    reposts: number;
  }>();

  if (maxRequests <= 0 || !postUrns.length) return analytics;

  const targetUrns = postUrns.slice(0, maxRequests);
  if (postUrns.length > targetUrns.length) {
    console.log(`[linkedin-dma] Post analytics limited to ${targetUrns.length}/${postUrns.length} posts to reduce DMA throttling`);
  }

  for (const urn of targetUrns) {
    try {
      const metrics = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,REACTIONS,COMMENTS,REPOSTS)';
      const url = `${API_REST_URL}/dmaOrganizationalPageContentAnalytics` +
        `?q=trend` +
        `&sourceEntity=${encodeURIComponent(urn)}` +
        `&metricTypes=${metrics}`;

      const response = await apiRequest<{ elements?: ContentAnalyticsElement[] }>(
        'linkedin', url, { headers }, 'linkedin_dma_post_analytics', true
      );

      const data = { impressions: 0, uniqueImpressions: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0 };
      for (const element of response.elements ?? []) {
        const count = getMetricTotalCount(element);
        switch (element.type) {
          case 'IMPRESSIONS': data.impressions += count; break;
          case 'UNIQUE_IMPRESSIONS': data.uniqueImpressions += count; break;
          case 'CLICKS': data.clicks += count; break;
          case 'REACTIONS': data.reactions += count; break;
          case 'COMMENTS': data.comments += count; break;
          case 'REPOSTS': data.reposts += count; break;
        }
      }
      analytics.set(urn, data);
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 429) {
        console.log('[linkedin-dma] Post analytics rate-limited, stopping post analytics fetch');
        break;
      }
      // Silently skip — post analytics may not be available for all posts.
    }
  }

  return analytics;
}

function getPostCaption(detail?: DmaPostElement): string {
  if (!detail) return 'LinkedIn post';
  if (typeof detail.commentary === 'string' && detail.commentary.trim().length > 0) {
    return detail.commentary.slice(0, 280);
  }
  const commentaryText = getNestedValue(detail.commentary, ['text']);
  if (typeof commentaryText === 'string' && commentaryText.trim().length > 0) {
    return commentaryText.slice(0, 280);
  }
  return 'LinkedIn post';
}

function getPostDetailStats(detail?: DmaPostElement): {
  impressions: number;
  reach: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
} {
  if (!detail) {
    return { impressions: 0, reach: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0 };
  }

  const impressions = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'impressionCount'],
    ['distribution', 'totalShareStatistics', 'impressionCount'],
  ]);
  const reach = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'uniqueImpressionCount'],
    ['distribution', 'totalShareStatistics', 'uniqueImpressionCount'],
  ]);
  const clicks = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'clickCount'],
    ['distribution', 'totalShareStatistics', 'clickCount'],
  ]);
  const reactions = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'likeCount'],
    ['distribution', 'totalShareStatistics', 'likeCount'],
  ]);
  const comments = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'commentCount'],
    ['distribution', 'totalShareStatistics', 'commentCount'],
  ]);
  const reposts = getFirstNumber(detail, [
    ['socialDetail', 'totalShareStatistics', 'shareCount'],
    ['distribution', 'totalShareStatistics', 'shareCount'],
  ]);

  const collectByKeywords = (keywords: string[]): number => {
    const candidates: number[] = [];

    const walk = (input: unknown, path: string[] = []) => {
      if (input == null) return;
      if (typeof input === 'number' || typeof input === 'string') {
        const value = toNumber(input);
        if (value <= 0) return;
        const joined = path.join('.').toLowerCase();
        if (keywords.some((keyword) => joined.includes(keyword))) {
          candidates.push(value);
        }
        return;
      }
      if (typeof input !== 'object') return;
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        walk(value, [...path, key]);
      }
    };

    walk(detail);
    return candidates.length > 0 ? Math.max(...candidates) : 0;
  };

  return {
    impressions: impressions || collectByKeywords(['impression', 'view']),
    reach: reach || collectByKeywords(['uniqueimpression', 'reach']),
    clicks: clicks || collectByKeywords(['click']),
    reactions: reactions || collectByKeywords(['reaction', 'like']),
    comments: comments || collectByKeywords(['comment']),
    reposts: reposts || collectByKeywords(['repost', 'share']),
  };
}

// ── Connector ──────────────────────────────────────────────────────────

export const linkedinConnector: Connector = {
  platform: 'linkedin',

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error('Missing LinkedIn access token — needs_reauth');
    }

    console.log(`[linkedin-dma] Starting sync for org=${externalAccountId}, LinkedIn-Version=${API_VERSION}`);
    const headers = buildHeaders(accessToken);

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    now.setUTCHours(23, 59, 59, 999);

    // Initialize daily map with empty metrics
    const dailyMap = new Map<string, DailyMetric>();
    for (let d = new Date(since); d <= now; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      dailyMap.set(date, {
        date,
        impressions: 0,
        reach: 0,
        engagements: 0,
        posts_count: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      });
    }

    const organizationId = normalizeOrganizationId(externalAccountId);

    // Resolve the organizationalPage URN (may differ from org ID)
    const resolvedPageUrn = await resolveOrganizationalPageUrn(headers, organizationId);

    // 1. Fetch follower data via EdgeAnalytics (primary)
    let totalFollowers = 0;
    let dailyGainsTotal = 0;
    try {
      const followerData = await fetchFollowerTrend(headers, organizationId, since, now, resolvedPageUrn);
      totalFollowers = followerData.totalFollowers;
      console.log(`[linkedin-dma] EdgeAnalytics: totalFollowers=${totalFollowers}, daily entries=${Object.keys(followerData.daily).length}`);
      for (const [dateKey, count] of Object.entries(followerData.daily)) {
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.followers = (entry.followers ?? 0) + count;
          dailyGainsTotal += count;
        }
      }
    } catch (error) {
      if (error instanceof SocialApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        console.error(`[linkedin-dma] Auth error fetching follower trend (${error.statusCode}): needs_reauth or missing_permission`);
        throw new Error(`LinkedIn auth error (${error.statusCode}) — needs_reauth`);
      }
      console.log('[linkedin-dma] Failed to fetch follower trend:', error instanceof Error ? error.message : error);
    }

    // Fallback: use fetchFollowerCount cascade if EdgeAnalytics returned 0
    if (totalFollowers === 0) {
      try {
        const fallbackCount = await fetchFollowerCount(headers, organizationId, resolvedPageUrn);
        if (fallbackCount > 1) {
          totalFollowers = fallbackCount;
          console.log(`[linkedin-dma] Follower count fallback: ${fallbackCount}`);
        }
      } catch (error) {
        console.log('[linkedin-dma] Follower count fallback failed:', error instanceof Error ? error.message : error);
      }
    }

    // Set total followers on latest date for cumsum conversion in sync.ts.
    // IMPORTANT: sync.ts treats all metric.followers values as deltas (gains)
    // and accumulates them. So we must NOT put the absolute total here directly.
    // Instead, we set the total on the latest date ONLY — sync.ts will detect
    // this is much larger than daily gains and use it as the cumulative anchor.
    const latestDate = Array.from(dailyMap.keys()).sort().slice(-1)[0];
    if (latestDate && totalFollowers > 0) {
      const entry = dailyMap.get(latestDate);
      if (entry) {
        // Clear the daily gain on the latest date — replace with the total.
        // sync.ts cumsum will add baseline + gains_day1..day29 + this value.
        // Since we want the final result to equal totalFollowers, we set
        // the latest date's value = totalFollowers (sync.ts handles it).
        entry.followers = totalFollowers;
      }
    }

    console.log(`[linkedin-dma] Final: totalFollowers=${totalFollowers}, dailyGainsTotal=${dailyGainsTotal}, orgId=${organizationId}`);

    // 2. Fetch page-level content analytics (daily impressions, reactions, etc.)
    let contentTrendLoaded = false;
    let contentTrendRateLimited = false;
    try {
      const contentTrend = await fetchPageContentTrend(headers, organizationId, since, now);
      for (const [dateKey, counts] of contentTrend) {
        const entry = dailyMap.get(dateKey);
        if (!entry) continue;
        entry.impressions = (entry.impressions ?? 0) + counts.impressions;
        entry.reach = (entry.reach ?? 0) + counts.uniqueImpressions;
        entry.likes = (entry.likes ?? 0) + counts.reactions;
        entry.comments = (entry.comments ?? 0) + counts.comments;
        entry.shares = (entry.shares ?? 0) + counts.reposts;
        entry.engagements = (entry.engagements ?? 0) + counts.reactions + counts.comments + counts.reposts + counts.clicks;
        entry.views = (entry.views ?? 0) + counts.impressions;
      }
      contentTrendLoaded = true;
    } catch (error) {
      if (error instanceof SocialApiError && error.statusCode === 429) {
        contentTrendRateLimited = true;
      }
      console.log('[linkedin-dma] Failed to fetch content trend:', error instanceof Error ? error.message : error);
    }

    // 3. Fetch posts
    let postUrns: string[] = [];
    try {
      postUrns = await fetchDmaPosts(headers, organizationId, MAX_POSTS_SYNC);
      console.log(`[linkedin-dma] Fetched ${postUrns.length} post URNs for org ${organizationId}`);
    } catch (error) {
      console.log('[linkedin-dma] Failed to fetch posts list:', error instanceof Error ? error.message : error);
    }

    const posts: PostMetric[] = [];

    if (postUrns.length > 0) {
      if (contentTrendRateLimited) {
        console.log('[linkedin-dma] Content trend is rate-limited; skipping post analytics requests in this sync');
      }

      // 4. Fetch post details and post-level metrics in parallel
      const metricsUrns = postUrns.slice(0, MAX_POST_METRICS_SYNC);
      const [postDetails, socialMetadata, postAnalytics] = await Promise.all([
        fetchPostDetails(headers, postUrns),
        fetchSocialMetadata(headers, metricsUrns),
        fetchPostAnalytics(
          headers,
          metricsUrns,
          contentTrendRateLimited ? 0 : MAX_POST_METRICS_SYNC
        ),
      ]);

      for (const urn of postUrns) {
        const normalizedUrn = normalizePostUrn(urn);
        const detail = postDetails.get(urn) ?? postDetails.get(normalizedUrn);
        const social = socialMetadata.get(urn);
        const analytics = postAnalytics.get(urn);
        const detailStats = getPostDetailStats(detail);

        const createdAt = detail?.publishedAt ?? detail?.created?.time ?? detail?.createdAt ?? Date.now();
        const postedAt = toLinkedInIsoDate(createdAt);
        const caption = getPostCaption(detail);

        const reactions = analytics?.reactions ?? social?.reactions ?? detailStats.reactions;
        const comments = analytics?.comments ?? social?.comments ?? detailStats.comments;
        const reposts = analytics?.reposts ?? social?.reposts ?? detailStats.reposts;
        const impressions = analytics?.impressions ?? detailStats.impressions;
        const uniqueImpressions = analytics?.uniqueImpressions ?? detailStats.reach;
        const clicks = analytics?.clicks ?? detailStats.clicks;
        const engagements = reactions + comments + reposts + clicks;

        const metrics: Record<string, number> = {};
        if (impressions > 0) metrics.impressions = impressions;
        if (uniqueImpressions > 0) metrics.reach = uniqueImpressions;
        if (engagements > 0) metrics.engagements = engagements;
        if (reactions > 0) metrics.likes = reactions;
        if (comments > 0) metrics.comments = comments;
        if (reposts > 0) metrics.shares = reposts;
        if (clicks > 0) metrics.clicks = clicks;

        posts.push({
          external_post_id: urn,
          posted_at: postedAt,
          url: `https://www.linkedin.com/feed/update/${urn}`,
          caption,
          media_type: detectLinkedInMediaType(detail?.content),
          metrics,
          raw_json: detail as Record<string, unknown> ?? {}
        });

        // Count posts per day
        const dateKey = postedAt.slice(0, 10);
        const entry = dailyMap.get(dateKey);
        if (entry) {
          entry.posts_count = (entry.posts_count ?? 0) + 1;
          // If page-level trend is unavailable, fallback to post-level metrics.
          if (!contentTrendLoaded) {
            entry.impressions = (entry.impressions ?? 0) + impressions;
            entry.reach = (entry.reach ?? 0) + (uniqueImpressions || impressions);
            entry.likes = (entry.likes ?? 0) + reactions;
            entry.comments = (entry.comments ?? 0) + comments;
            entry.shares = (entry.shares ?? 0) + reposts;
            entry.engagements = (entry.engagements ?? 0) + engagements;
            entry.views = (entry.views ?? 0) + impressions;
          }
        }
      }
    }

    const postsWithMetrics = posts.filter((post) => {
      const metrics = post.metrics ?? {};
      return (
        toNumber(metrics.impressions) > 0 ||
        toNumber(metrics.reach) > 0 ||
        toNumber(metrics.engagements) > 0 ||
        toNumber(metrics.likes) > 0 ||
        toNumber(metrics.comments) > 0 ||
        toNumber(metrics.shares) > 0
      );
    }).length;
    console.log(`[linkedin-dma] Post metrics coverage: ${postsWithMetrics}/${posts.length} posts with non-zero metrics`);

    const dailyMetrics = Array.from(dailyMap.values());
    dailyMetrics.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return { dailyMetrics, posts };
  }
};
