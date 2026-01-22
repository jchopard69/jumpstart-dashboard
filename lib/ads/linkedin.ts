import { apiRequest } from "@/lib/social-platforms/core/api-client";
import { getLinkedInVersion } from "@/lib/social-platforms/linkedin/config";

export type LinkedInAdAnalytics = {
  campaignId: string;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  results: number;
  raw: Record<string, unknown>;
};

const API_BASE = "https://api.linkedin.com/v2";

function buildDateRange(start: Date, end: Date) {
  return `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;
}

function normalizeSponsoredAccount(adAccountId: string) {
  return adAccountId.startsWith("urn:li:sponsoredAccount:")
    ? adAccountId
    : `urn:li:sponsoredAccount:${adAccountId}`;
}

export async function fetchLinkedInAdAnalytics(
  accessToken: string,
  adAccountId: string,
  start: Date,
  end: Date
) {
  const accountUrn = normalizeSponsoredAccount(adAccountId);
  const dateRange = buildDateRange(start, end);
  const url = `${API_BASE}/adAnalyticsV2?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&${dateRange}&accounts=List(${encodeURIComponent(accountUrn)})`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  const version = getLinkedInVersion();
  if (version) {
    headers["LinkedIn-Version"] = version;
  }

  const response = await apiRequest<{ elements?: Array<Record<string, unknown>> }>(
    "linkedin",
    url,
    { headers },
    "linkedin_ads_analytics"
  );

  return (response.elements ?? []).map((element) => {
    const dateRangeObj = element.dateRange as Record<string, unknown> | undefined;
    const startObj = dateRangeObj?.start as Record<string, number> | undefined;
    const date = startObj
      ? new Date(Date.UTC(startObj.year ?? 0, (startObj.month ?? 1) - 1, startObj.day ?? 1)).toISOString().slice(0, 10)
      : "";
    const pivotValues = element.pivotValues as string[] | undefined;
    const campaignUrn = pivotValues?.[0] ?? "";

    return {
      campaignId: campaignUrn,
      date,
      impressions: Number(element.impressions ?? 0),
      reach: Number(element.approximateUniqueImpressions ?? 0),
      clicks: Number(element.clicks ?? 0),
      spend: Number(element.costInLocalCurrency ?? 0),
      conversions: Number(element.externalWebsiteConversions ?? 0),
      results: Number(element.externalWebsiteConversions ?? 0),
      raw: element as Record<string, unknown>
    };
  });
}
