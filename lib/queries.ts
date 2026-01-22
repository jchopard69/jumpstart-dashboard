import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { assertTenant } from "@/lib/auth";
import { buildPreviousRange, resolveDateRange } from "@/lib/date";
import type { Platform } from "@/lib/types";

export async function fetchDashboardData(params: {
  preset: any;
  from?: string;
  to?: string;
  platform?: Platform | "all";
  socialAccountId?: string;
  platforms?: Platform[];
  profile: { tenant_id: string | null; role?: string | null };
  tenantId?: string;
}) {
  const isAdmin = params.profile.role === "agency_admin" && params.tenantId;
  const supabase = isAdmin ? createSupabaseServiceClient() : createSupabaseServerClient();
  const tenantId = isAdmin ? params.tenantId! : assertTenant(params.profile as any);
  const range = resolveDateRange(params.preset, params.from, params.to);
  const prevRange = buildPreviousRange(range);

  let metricsQuery = supabase
    .from("social_daily_metrics")
    .select("date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform")
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10));

  let prevQuery = supabase
    .from("social_daily_metrics")
    .select("date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform")
    .eq("tenant_id", tenantId)
    .gte("date", prevRange.start.toISOString().slice(0, 10))
    .lte("date", prevRange.end.toISOString().slice(0, 10));

  if (params.platform && params.platform !== "all") {
    metricsQuery = metricsQuery.eq("platform", params.platform);
    prevQuery = prevQuery.eq("platform", params.platform);
  }

  if (params.socialAccountId) {
    metricsQuery = metricsQuery.eq("social_account_id", params.socialAccountId);
    prevQuery = prevQuery.eq("social_account_id", params.socialAccountId);
  }

  const [{ data: metrics }, { data: prevMetrics }] = await Promise.all([
    metricsQuery.order("date", { ascending: true }),
    prevQuery.order("date", { ascending: true })
  ]);

  const sumLatestFollowers = (rows?: Array<{ social_account_id?: string | null; date?: string | null; followers?: number | null }>) => {
    if (!rows?.length) return 0;
    const latestByAccount = new Map<string, { date: string; followers: number }>();
    for (const row of rows) {
      if (!row.social_account_id || row.followers == null || !row.date) continue;
      const existing = latestByAccount.get(row.social_account_id);
      if (!existing || row.date > existing.date) {
        latestByAccount.set(row.social_account_id, { date: row.date, followers: row.followers });
      }
    }
    let total = 0;
    for (const entry of latestByAccount.values()) {
      total += entry.followers;
    }
    return total;
  };
  const followersCurrent = sumLatestFollowers(metrics ?? undefined);
  const followersPrev = sumLatestFollowers(prevMetrics ?? undefined);

  const totals = metrics?.reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.reach += row.reach ?? 0;
      acc.engagements += row.engagements ?? 0;
      acc.views += row.views ?? 0;
      acc.watch_time += row.watch_time ?? 0;
      return acc;
    },
    {
      followers: followersCurrent,
      impressions: 0,
      reach: 0,
      engagements: 0,
      views: 0,
      watch_time: 0,
      posts_count: 0
    }
  );

  const prevTotals = prevMetrics?.reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.reach += row.reach ?? 0;
      acc.engagements += row.engagements ?? 0;
      acc.views += row.views ?? 0;
      acc.watch_time += row.watch_time ?? 0;
      return acc;
    },
    {
      followers: followersPrev,
      impressions: 0,
      reach: 0,
      engagements: 0,
      views: 0,
      watch_time: 0,
      posts_count: 0
    }
  );
  const totalsSafe = totals ?? {
    followers: 0,
    impressions: 0,
    reach: 0,
    engagements: 0,
    views: 0,
    watch_time: 0,
    posts_count: 0
  };
  const prevTotalsSafe = prevTotals ?? {
    followers: 0,
    impressions: 0,
    reach: 0,
    engagements: 0,
    views: 0,
    watch_time: 0,
    posts_count: 0
  };

  let postsCountQuery = supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("posted_at", range.start.toISOString())
    .lte("posted_at", range.end.toISOString());

  let prevPostsCountQuery = supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("posted_at", prevRange.start.toISOString())
    .lte("posted_at", prevRange.end.toISOString());

  if (params.platform && params.platform !== "all") {
    postsCountQuery = postsCountQuery.eq("platform", params.platform);
    prevPostsCountQuery = prevPostsCountQuery.eq("platform", params.platform);
  }

  if (params.socialAccountId) {
    postsCountQuery = postsCountQuery.eq("social_account_id", params.socialAccountId);
    prevPostsCountQuery = prevPostsCountQuery.eq("social_account_id", params.socialAccountId);
  }

  const [{ count: postsCount }, { count: prevPostsCount }] = await Promise.all([
    postsCountQuery,
    prevPostsCountQuery
  ]);

  const deltaRaw = {
    followers: followersCurrent - followersPrev,
    impressions: totalsSafe.impressions - prevTotalsSafe.impressions,
    reach: totalsSafe.reach - prevTotalsSafe.reach,
    engagements: totalsSafe.engagements - prevTotalsSafe.engagements,
    views: totalsSafe.views - prevTotalsSafe.views,
    watch_time: totalsSafe.watch_time - prevTotalsSafe.watch_time,
    posts_count: (postsCount ?? 0) - (prevPostsCount ?? 0)
  };

  const deltaPercent = {
    followers: followersPrev ? (deltaRaw.followers / followersPrev) * 100 : 0,
    impressions: prevTotalsSafe.impressions ? (deltaRaw.impressions / prevTotalsSafe.impressions) * 100 : 0,
    reach: prevTotalsSafe.reach ? (deltaRaw.reach / prevTotalsSafe.reach) * 100 : 0,
    engagements: prevTotalsSafe.engagements ? (deltaRaw.engagements / prevTotalsSafe.engagements) * 100 : 0,
    views: prevTotalsSafe.views ? (deltaRaw.views / prevTotalsSafe.views) * 100 : 0,
    watch_time: prevTotalsSafe.watch_time ? (deltaRaw.watch_time / prevTotalsSafe.watch_time) * 100 : 0,
    posts_count: prevPostsCount ? (deltaRaw.posts_count / prevPostsCount) * 100 : 0
  };

  let postsQuery = supabase
    .from("social_posts")
    .select("id,caption,thumbnail_url,posted_at,metrics,url,platform")
    .eq("tenant_id", tenantId)
    .gte("posted_at", range.start.toISOString())
    .lte("posted_at", range.end.toISOString());

  if (params.socialAccountId) {
    postsQuery = postsQuery.eq("social_account_id", params.socialAccountId);
  }

  const { data: posts } = await postsQuery.order("posted_at", { ascending: false }).limit(50);

  const resolveAdsPlatform = () => {
    if (!params.platform || params.platform === "all") return null;
    if (params.platform === "linkedin") return "linkedin";
    if (params.platform === "facebook" || params.platform === "instagram") return "meta";
    return null;
  };

  const adsPlatformFilter = resolveAdsPlatform();
  let adsMetricsQuery = supabase
    .from("ad_campaign_metrics_daily")
    .select("platform,external_campaign_id,date,impressions,reach,clicks,spend,conversions,results")
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10));

  let adsCampaignsQuery = supabase
    .from("ad_campaigns")
    .select("platform,external_campaign_id,name,objective,status")
    .eq("tenant_id", tenantId);

  if (adsPlatformFilter) {
    adsMetricsQuery = adsMetricsQuery.eq("platform", adsPlatformFilter);
    adsCampaignsQuery = adsCampaignsQuery.eq("platform", adsPlatformFilter);
  }

  const [{ data: adsMetrics }, { data: adsCampaigns }] = await Promise.all([
    adsMetricsQuery,
    adsCampaignsQuery
  ]);

  const campaignNameMap = new Map<string, string>();
  for (const campaign of adsCampaigns ?? []) {
    const key = `${campaign.platform}:${campaign.external_campaign_id}`;
    campaignNameMap.set(key, campaign.name ?? "Campagne");
  }

  const adsTotals = (adsMetrics ?? []).reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.reach += row.reach ?? 0;
      acc.clicks += row.clicks ?? 0;
      acc.spend += Number(row.spend ?? 0);
      acc.conversions += row.conversions ?? 0;
      acc.results += row.results ?? 0;
      return acc;
    },
    { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, results: 0 }
  );

  const adsAggregated = new Map<string, { impressions: number; reach: number; clicks: number; spend: number; conversions: number; results: number; platform: string; name: string }>();
  for (const row of adsMetrics ?? []) {
    const key = `${row.platform}:${row.external_campaign_id}`;
    const existing = adsAggregated.get(key) ?? {
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      results: 0,
      platform: row.platform,
      name: campaignNameMap.get(key) ?? "Campagne"
    };
    existing.impressions += row.impressions ?? 0;
    existing.reach += row.reach ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.spend += Number(row.spend ?? 0);
    existing.conversions += row.conversions ?? 0;
    existing.results += row.results ?? 0;
    adsAggregated.set(key, existing);
  }

  const adsTopCampaigns = Array.from(adsAggregated.values())
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 6);

  const adsPlatformMap = new Map<string, { impressions: number; reach: number; clicks: number; spend: number; conversions: number; results: number; platform: string }>();
  for (const row of adsMetrics ?? []) {
    const platform = row.platform ?? "meta";
    const existing = adsPlatformMap.get(platform) ?? {
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      results: 0,
      platform
    };
    existing.impressions += row.impressions ?? 0;
    existing.reach += row.reach ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.spend += Number(row.spend ?? 0);
    existing.conversions += row.conversions ?? 0;
    existing.results += row.results ?? 0;
    adsPlatformMap.set(platform, existing);
  }
  const adsPlatforms = Array.from(adsPlatformMap.values()).sort((a, b) => b.spend - a.spend);

  const { data: collaboration } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining,notes,updated_at")
    .eq("tenant_id", tenantId)
    .single();

  const { data: shoots } = await supabase
    .from("upcoming_shoots")
    .select("id,shoot_date,location,notes")
    .eq("tenant_id", tenantId)
    .order("shoot_date", { ascending: true });

  const { data: documents } = await supabase
    .from("documents")
    .select("id,file_name,tag,pinned,created_at,file_path")
    .eq("tenant_id", tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("status,finished_at")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  const sortedPosts = (posts ?? []).sort((a, b) => {
    const aImp = a.metrics?.impressions ?? a.metrics?.views ?? 0;
    const bImp = b.metrics?.impressions ?? b.metrics?.views ?? 0;
    const aEng = a.metrics?.engagements ?? a.metrics?.likes ?? 0;
    const bEng = b.metrics?.engagements ?? b.metrics?.likes ?? 0;
    return bImp - aImp || bEng - aEng;
  });

  const availablePlatforms = params.platform && params.platform !== "all"
    ? [params.platform]
    : params.platforms?.length
      ? params.platforms
      : Array.from(new Set((metrics ?? []).map((row) => row.platform as Platform).filter(Boolean)));

  const buildPlatformStats = (platform: Platform) => {
    const currentRows = (metrics ?? []).filter((row) => row.platform === platform);
    const prevRows = (prevMetrics ?? []).filter((row) => row.platform === platform);
    const currentFollowers = sumLatestFollowers(currentRows);
    const prevFollowers = sumLatestFollowers(prevRows);

    const currentTotals = currentRows.reduce(
      (acc, row) => {
        acc.impressions += row.impressions ?? 0;
        acc.reach += row.reach ?? 0;
        acc.engagements += row.engagements ?? 0;
        acc.views += row.views ?? 0;
        acc.watch_time += row.watch_time ?? 0;
        return acc;
      },
      { followers: currentFollowers, impressions: 0, reach: 0, engagements: 0, views: 0, watch_time: 0, posts_count: 0 }
    );

    const prevTotalsPlatform = prevRows.reduce(
      (acc, row) => {
        acc.impressions += row.impressions ?? 0;
        acc.reach += row.reach ?? 0;
        acc.engagements += row.engagements ?? 0;
        acc.views += row.views ?? 0;
        acc.watch_time += row.watch_time ?? 0;
        return acc;
      },
      { followers: prevFollowers, impressions: 0, reach: 0, engagements: 0, views: 0, watch_time: 0, posts_count: 0 }
    );

    return {
      platform,
      totals: currentTotals,
      prevTotals: prevTotalsPlatform
    };
  };

  const perPlatform = availablePlatforms.map(buildPlatformStats);

  const countPostsByPlatform = async (platform: Platform, rangeStart: Date, rangeEnd: Date) => {
    let query = supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("platform", platform)
      .gte("posted_at", rangeStart.toISOString())
      .lte("posted_at", rangeEnd.toISOString());

    if (params.socialAccountId) {
      query = query.eq("social_account_id", params.socialAccountId);
    }

    const { count } = await query;
    return count ?? 0;
  };

  const postsByPlatform = await Promise.all(
    perPlatform.map(async (item) => ({
      platform: item.platform,
      current: await countPostsByPlatform(item.platform, range.start, range.end),
      previous: await countPostsByPlatform(item.platform, prevRange.start, prevRange.end)
    }))
  );

  const platformSummaries = perPlatform.map((item) => {
    const counts = postsByPlatform.find((entry) => entry.platform === item.platform);
    const postsCurrent = counts?.current ?? 0;
    const postsPrev = counts?.previous ?? 0;
    const delta = {
      followers: item.totals.followers - item.prevTotals.followers,
      views: item.totals.views - item.prevTotals.views,
      reach: item.totals.reach - item.prevTotals.reach,
      engagements: item.totals.engagements - item.prevTotals.engagements,
      posts_count: postsCurrent - postsPrev
    };
    const deltaPercent = {
      followers: item.prevTotals.followers ? (delta.followers / item.prevTotals.followers) * 100 : 0,
      views: item.prevTotals.views ? (delta.views / item.prevTotals.views) * 100 : 0,
      reach: item.prevTotals.reach ? (delta.reach / item.prevTotals.reach) * 100 : 0,
      engagements: item.prevTotals.engagements ? (delta.engagements / item.prevTotals.engagements) * 100 : 0,
      posts_count: postsPrev ? (delta.posts_count / postsPrev) * 100 : 0
    };
    const available = {
      views: item.totals.views > 0 || item.prevTotals.views > 0,
      reach: item.totals.reach > 0 || item.prevTotals.reach > 0,
      engagements: item.totals.engagements > 0 || item.prevTotals.engagements > 0
    };

    return {
      platform: item.platform,
      totals: { ...item.totals, posts_count: postsCurrent },
      delta: deltaPercent,
      available
    };
  });

  return {
    range,
    prevRange,
    totals: { ...totalsSafe, posts_count: postsCount ?? 0 },
    delta: deltaPercent,
    metrics: metrics ?? [],
    prevMetrics: prevMetrics ?? [],
    posts: sortedPosts,
    perPlatform: platformSummaries,
    ads: {
      totals: {
        ...adsTotals,
        ctr: adsTotals.impressions ? (adsTotals.clicks / adsTotals.impressions) * 100 : 0,
        cpc: adsTotals.clicks ? adsTotals.spend / adsTotals.clicks : 0,
        cpm: adsTotals.impressions ? (adsTotals.spend / adsTotals.impressions) * 1000 : 0
      },
      topCampaigns: adsTopCampaigns,
      platforms: adsPlatforms,
      available: adsTotals.impressions > 0 || adsTotals.spend > 0
    },
    collaboration,
    shoots: shoots ?? [],
    documents: documents ?? [],
    lastSync
  };
}

export async function fetchDashboardAccounts(params: {
  profile: { tenant_id: string | null; role?: string | null };
  tenantId?: string;
}) {
  const isAdmin = params.profile.role === "agency_admin" && params.tenantId;
  const supabase = isAdmin ? createSupabaseServiceClient() : createSupabaseServerClient();
  const tenantId = isAdmin ? params.tenantId! : assertTenant(params.profile as any);

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id,platform,account_name,external_account_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  return accounts ?? [];
}

export async function fetchAdsData(params: {
  preset: any;
  from?: string;
  to?: string;
  platform?: "meta" | "linkedin" | "all";
  profile: { tenant_id: string | null; role?: string | null };
  tenantId?: string;
}) {
  const isAdmin = params.profile.role === "agency_admin" && params.tenantId;
  const supabase = isAdmin ? createSupabaseServiceClient() : createSupabaseServerClient();
  const tenantId = isAdmin ? params.tenantId! : assertTenant(params.profile as any);
  const range = resolveDateRange(params.preset, params.from, params.to);

  let metricsQuery = supabase
    .from("ad_campaign_metrics_daily")
    .select("platform,external_campaign_id,date,impressions,reach,clicks,spend,conversions,results")
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10));

  let campaignsQuery = supabase
    .from("ad_campaigns")
    .select("platform,external_campaign_id,name,status,objective")
    .eq("tenant_id", tenantId);

  if (params.platform && params.platform !== "all") {
    metricsQuery = metricsQuery.eq("platform", params.platform);
    campaignsQuery = campaignsQuery.eq("platform", params.platform);
  }

  const [{ data: metrics }, { data: campaigns }] = await Promise.all([
    metricsQuery.order("date", { ascending: true }),
    campaignsQuery
  ]);

  const campaignNameMap = new Map<string, string>();
  for (const campaign of campaigns ?? []) {
    const key = `${campaign.platform}:${campaign.external_campaign_id}`;
    campaignNameMap.set(key, campaign.name ?? "Campagne");
  }

  const totals = (metrics ?? []).reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.reach += row.reach ?? 0;
      acc.clicks += row.clicks ?? 0;
      acc.spend += Number(row.spend ?? 0);
      acc.conversions += row.conversions ?? 0;
      acc.results += row.results ?? 0;
      return acc;
    },
    { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, results: 0 }
  );

  const dailyMap = new Map<string, { date: string; impressions: number; spend: number; clicks: number }>();
  for (const row of metrics ?? []) {
    const date = row.date;
    const entry = dailyMap.get(date) ?? { date, impressions: 0, spend: 0, clicks: 0 };
    entry.impressions += row.impressions ?? 0;
    entry.spend += Number(row.spend ?? 0);
    entry.clicks += row.clicks ?? 0;
    dailyMap.set(date, entry);
  }

  const campaignAgg = new Map<string, { impressions: number; reach: number; spend: number; clicks: number; conversions: number; results: number; platform: string; name: string }>();
  for (const row of metrics ?? []) {
    const key = `${row.platform}:${row.external_campaign_id}`;
    const entry = campaignAgg.get(key) ?? {
      impressions: 0,
      reach: 0,
      spend: 0,
      clicks: 0,
      conversions: 0,
      results: 0,
      platform: row.platform,
      name: campaignNameMap.get(key) ?? "Campagne"
    };
    entry.impressions += row.impressions ?? 0;
    entry.reach += row.reach ?? 0;
    entry.spend += Number(row.spend ?? 0);
    entry.clicks += row.clicks ?? 0;
    entry.conversions += row.conversions ?? 0;
    entry.results += row.results ?? 0;
    campaignAgg.set(key, entry);
  }

  const topCampaigns = Array.from(campaignAgg.values())
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  const platformAgg = new Map<string, { impressions: number; reach: number; clicks: number; spend: number; conversions: number; results: number; platform: string }>();
  for (const row of metrics ?? []) {
    const platform = row.platform ?? "meta";
    const entry = platformAgg.get(platform) ?? {
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      results: 0,
      platform
    };
    entry.impressions += row.impressions ?? 0;
    entry.reach += row.reach ?? 0;
    entry.clicks += row.clicks ?? 0;
    entry.spend += Number(row.spend ?? 0);
    entry.conversions += row.conversions ?? 0;
    entry.results += row.results ?? 0;
    platformAgg.set(platform, entry);
  }

  return {
    range,
    totals: {
      ...totals,
      ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0
    },
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topCampaigns,
    platforms: Array.from(platformAgg.values()).sort((a, b) => b.spend - a.spend),
    available: totals.impressions > 0 || totals.spend > 0
  };
}
