import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export type AdPlatform = "meta" | "linkedin";

export type AdCampaignRow = {
  id: string;
  name: string | null;
  platform: AdPlatform;
  status: string | null;
  objective: string | null;
  start_time: string | null;
  end_time: string | null;
  external_campaign_id: string;
  ad_account_id: string;
};

export type AdMetricRow = {
  id: string;
  platform: AdPlatform;
  ad_account_id: string;
  external_campaign_id: string;
  date: string;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  results: number | null;
};

export type DailyAdsPoint = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
};

export type CampaignSummary = {
  id: string;
  name: string;
  platform: AdPlatform;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  ctr: number;
  cpc: number;
};

export type AdsSummary = {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  roas: number | null;
  daily: DailyAdsPoint[];
  campaigns: CampaignSummary[];
};

function coerce(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}

export async function fetchAdsSummary(
  tenantId: string,
  from: string,
  to: string,
  options?: { isAdmin?: boolean }
): Promise<AdsSummary> {
  const supabase = options?.isAdmin
    ? createSupabaseServiceClient()
    : createSupabaseServerClient();

  // Fetch metrics and campaigns in parallel
  const [{ data: metrics, error: metricsError }, { data: campaigns, error: campaignsError }] =
    await Promise.all([
      supabase
        .from("ad_campaign_metrics_daily")
        .select(
          "id,platform,ad_account_id,external_campaign_id,date,impressions,reach,clicks,spend,ctr,cpc,cpm,conversions,results"
        )
        .eq("tenant_id", tenantId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      supabase
        .from("ad_campaigns")
        .select(
          "id,name,platform,status,objective,external_campaign_id,ad_account_id,start_time,end_time"
        )
        .eq("tenant_id", tenantId)
    ]);

  if (metricsError) {
    console.error("[ads] Failed to load ad metrics", { tenantId, error: metricsError });
    throw new Error("Impossible de charger les métriques publicitaires.");
  }
  if (campaignsError) {
    console.error("[ads] Failed to load ad campaigns", { tenantId, error: campaignsError });
  }

  const rows = (metrics ?? []) as AdMetricRow[];
  const campaignRows = (campaigns ?? []) as AdCampaignRow[];

  // Aggregate totals
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalReach = 0;
  let totalConversions = 0;

  // Daily breakdown
  const dailyMap = new Map<string, DailyAdsPoint>();

  // Per-campaign aggregation
  const campaignMap = new Map<
    string,
    { spend: number; impressions: number; clicks: number; reach: number; conversions: number }
  >();

  for (const row of rows) {
    const spend = coerce(row.spend);
    const impressions = coerce(row.impressions);
    const clicks = coerce(row.clicks);
    const reach = coerce(row.reach);
    const conversions = coerce(row.conversions);

    totalSpend += spend;
    totalImpressions += impressions;
    totalClicks += clicks;
    totalReach += reach;
    totalConversions += conversions;

    // Daily aggregation
    const existing = dailyMap.get(row.date) ?? {
      date: row.date,
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      conversions: 0
    };
    existing.spend += spend;
    existing.impressions += impressions;
    existing.clicks += clicks;
    existing.reach += reach;
    existing.conversions += conversions;
    dailyMap.set(row.date, existing);

    // Campaign aggregation (key = ad_account_id:external_campaign_id)
    const campaignKey = `${row.ad_account_id}:${row.external_campaign_id}`;
    const cExisting = campaignMap.get(campaignKey) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      conversions: 0
    };
    cExisting.spend += spend;
    cExisting.impressions += impressions;
    cExisting.clicks += clicks;
    cExisting.reach += reach;
    cExisting.conversions += conversions;
    campaignMap.set(campaignKey, cExisting);
  }

  // Computed averages
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const roas = totalSpend > 0 && totalConversions > 0 ? totalConversions / totalSpend : null;

  // Build daily array sorted by date
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Build campaigns list
  const campaignSummaries: CampaignSummary[] = [];
  for (const campaignRow of campaignRows) {
    const key = `${campaignRow.ad_account_id}:${campaignRow.external_campaign_id}`;
    const totals = campaignMap.get(key);
    // Only include campaigns that have metrics in the date range
    if (!totals) continue;

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

    campaignSummaries.push({
      id: campaignRow.id,
      name: campaignRow.name ?? "Sans nom",
      platform: campaignRow.platform,
      status: campaignRow.status ?? "unknown",
      objective: campaignRow.objective ?? "",
      spend: totals.spend,
      impressions: totals.impressions,
      clicks: totals.clicks,
      reach: totals.reach,
      conversions: totals.conversions,
      ctr,
      cpc
    });
  }

  // Sort campaigns by spend descending by default
  campaignSummaries.sort((a, b) => b.spend - a.spend);

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalReach,
    totalConversions,
    avgCtr,
    avgCpc,
    avgCpm,
    roas,
    daily,
    campaigns: campaignSummaries
  };
}

export async function fetchAdAccounts(
  tenantId: string,
  options?: { isAdmin?: boolean }
) {
  const supabase = options?.isAdmin
    ? createSupabaseServiceClient()
    : createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ad_accounts")
    .select("id,platform,account_name,status,currency,last_sync_at")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[ads] Failed to load ad accounts", { tenantId, error });
    return [];
  }

  return data ?? [];
}
