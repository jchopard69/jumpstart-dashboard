import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { buildPreviousRange, resolveDateRange, toIsoDate } from "@/lib/date";
import { normalizeDashboardFilters } from "@/lib/dashboard-filters";
import { getDashboardMetricAvailability } from "@/lib/dashboard-metric-availability";
import { coerceMetric, getPostEngagements, getPostImpressions, getPostVisibility } from "@/lib/metrics";
import {
  normalizeLinkedInFollowerSeries,
  shouldRepairLinkedInFollowerSeries,
} from "@/lib/social-platforms/linkedin/community";
import type { Platform } from "@/lib/types";

export async function fetchDashboardData(params: {
  preset: any;
  from?: string;
  to?: string;
  platform?: Platform | "all";
  socialAccountId?: string;
  platforms?: Platform[];
  profile: { id?: string; tenant_id: string | null; role?: string | null };
  tenantId?: string;
}) {
  const supabase = createSupabaseServerClient();
  const tenantId = await resolveActiveTenantId(params.profile as any, params.tenantId);
  if (!tenantId) {
    throw new Error("Aucun workspace selectionne.");
  }
  const range = resolveDateRange(params.preset, params.from, params.to);
  const prevRange = buildPreviousRange(range);
  const filters = normalizeDashboardFilters({
    platform: params.platform,
    socialAccountId: params.socialAccountId
  });

  let metricsQuery = supabase
    .from("social_daily_metrics")
    .select("date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform")
    .eq("tenant_id", tenantId)
    .gte("date", toIsoDate(range.start))
    .lte("date", toIsoDate(range.end));

  let prevQuery = supabase
    .from("social_daily_metrics")
    .select("date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform")
    .eq("tenant_id", tenantId)
    .gte("date", toIsoDate(prevRange.start))
    .lte("date", toIsoDate(prevRange.end));

  if (filters.platform) {
    metricsQuery = metricsQuery.eq("platform", filters.platform);
    prevQuery = prevQuery.eq("platform", filters.platform);
  }

  if (filters.socialAccountId) {
    metricsQuery = metricsQuery.eq("social_account_id", filters.socialAccountId);
    prevQuery = prevQuery.eq("social_account_id", filters.socialAccountId);
  }

  const metricsPromise = metricsQuery.order("date", { ascending: true });
  const prevPromise = prevQuery.order("date", { ascending: true });
  const [{ data: metrics, error: metricsError }, { data: prevMetrics, error: prevMetricsError }] = await Promise.all([
    metricsPromise,
    prevPromise
  ]);
  if (metricsError || prevMetricsError) {
    console.error("[dashboard] Failed to load daily metrics", {
      tenantId,
      metricsError,
      prevMetricsError
    });
    throw new Error("Impossible de charger les métriques.");
  }

  const normalizeMetrics = <T extends {
    date?: string | null;
    platform?: Platform | null;
    social_account_id?: string | null;
    followers?: number | string | null;
    impressions?: number | string | null;
    reach?: number | string | null;
    engagements?: number | string | null;
    views?: number | string | null;
    watch_time?: number | string | null;
    posts_count?: number | string | null;
  }>(rows?: T[]) => (rows ?? []).map((row) => ({
    ...row,
    date: String(row.date ?? ""),
    platform: (row.platform ?? null) as Platform | null,
    social_account_id: row.social_account_id ? String(row.social_account_id) : null,
    followers: coerceMetric(row.followers),
    impressions: coerceMetric(row.impressions),
    reach: coerceMetric(row.reach),
    engagements: coerceMetric(row.engagements),
    views: coerceMetric(row.views),
    watch_time: coerceMetric(row.watch_time),
    posts_count: coerceMetric(row.posts_count)
  })) as Array<T & {
    followers: number;
    impressions: number;
    reach: number;
    engagements: number;
    views: number;
    watch_time: number;
    posts_count: number;
  }>;

  type NormalizedMetricRow = {
    date: string;
    platform?: Platform | null;
    social_account_id?: string | null;
    followers: number;
    impressions: number;
    reach: number;
    engagements: number;
    views: number;
    watch_time: number;
    posts_count: number;
  };

  const repairLinkedInFollowersOnRead = async (
    currentRows: NormalizedMetricRow[],
    previousRows: NormalizedMetricRow[]
  ) => {
    const linkedinRows = [...currentRows, ...previousRows].filter(
      (row) => row.platform === "linkedin" && row.social_account_id && row.date
    );
    if (!linkedinRows.length) {
      return { currentRows, previousRows };
    }

    const accountIds = Array.from(
      new Set(
        linkedinRows
          .map((row) => String(row.social_account_id ?? ""))
          .filter((value) => value.length > 0)
      )
    );
    const earliestDate = linkedinRows.reduce((min, row) => {
      const date = String(row.date ?? "");
      return !min || date < min ? date : min;
    }, "");

    if (!accountIds.length || !earliestDate) {
      return { currentRows, previousRows };
    }

    const [{ data: historicalRows, error: historicalError }, { data: baselineRows, error: baselineError }] =
      await Promise.all([
        supabase
          .from("social_daily_metrics")
          .select("date,followers,social_account_id,platform")
          .eq("tenant_id", tenantId)
          .eq("platform", "linkedin")
          .in("social_account_id", accountIds)
          .gte("date", earliestDate)
          .order("date", { ascending: true }),
        supabase
          .from("social_daily_metrics")
          .select("date,followers,social_account_id")
          .eq("tenant_id", tenantId)
          .eq("platform", "linkedin")
          .in("social_account_id", accountIds)
          .lt("date", earliestDate)
          .order("date", { ascending: false }),
      ]);

    if (historicalError || baselineError) {
      console.warn("[dashboard] Failed to repair LinkedIn follower series on read", {
        tenantId,
        historicalError,
        baselineError,
      });
      return { currentRows, previousRows };
    }

    const baselineByAccount = new Map<string, number>();
    for (const row of baselineRows ?? []) {
      const accountId = String(row.social_account_id ?? "");
      if (!accountId || baselineByAccount.has(accountId)) continue;
      baselineByAccount.set(accountId, coerceMetric(row.followers));
    }

    const seriesByAccount = new Map<string, Array<{ date: string; followers: number }>>();
    for (const row of historicalRows ?? []) {
      const accountId = String(row.social_account_id ?? "");
      const date = String(row.date ?? "");
      if (!accountId || !date) continue;
      const series = seriesByAccount.get(accountId) ?? [];
      series.push({ date, followers: coerceMetric(row.followers) });
      seriesByAccount.set(accountId, series);
    }

    const repairedByKey = new Map<string, number>();
    let repairedAccounts = 0;

    for (const [accountId, series] of seriesByAccount.entries()) {
      if (!shouldRepairLinkedInFollowerSeries(series)) {
        continue;
      }

      const normalizedSeries = normalizeLinkedInFollowerSeries(
        series.map((row) => ({
          date: row.date,
          followers: row.followers,
        })),
        baselineByAccount.get(accountId) ?? 0
      );

      for (const row of normalizedSeries) {
        repairedByKey.set(`${accountId}:${row.date}`, coerceMetric(row.followers));
      }
      repairedAccounts++;
    }

    if (!repairedAccounts) {
      return { currentRows, previousRows };
    }

    const applyRepairs = (rows: NormalizedMetricRow[]) =>
      rows.map((row) => {
        if (row.platform !== "linkedin" || !row.social_account_id || !row.date) {
          return row;
        }
        const repairedFollowers = repairedByKey.get(
          `${String(row.social_account_id)}:${String(row.date)}`
        );
        if (repairedFollowers == null) {
          return row;
        }
        return {
          ...row,
          followers: repairedFollowers,
        };
      });

    console.warn(
      `[dashboard] Repaired stale LinkedIn follower rows on read for ${repairedAccounts} account(s)`
    );

    return {
      currentRows: applyRepairs(currentRows),
      previousRows: applyRepairs(previousRows),
    };
  };

  let normalizedMetrics = normalizeMetrics(metrics ?? undefined) as NormalizedMetricRow[];
  let normalizedPrevMetrics = normalizeMetrics(prevMetrics ?? undefined) as NormalizedMetricRow[];
  const repairedLinkedInRows = await repairLinkedInFollowersOnRead(
    normalizedMetrics,
    normalizedPrevMetrics
  );
  normalizedMetrics = repairedLinkedInRows.currentRows;
  normalizedPrevMetrics = repairedLinkedInRows.previousRows;

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
  const followersCurrent = sumLatestFollowers(normalizedMetrics ?? undefined);
  const followersPrev = sumLatestFollowers(normalizedPrevMetrics ?? undefined);

  const totals = normalizedMetrics?.reduce(
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

  const prevTotals = normalizedPrevMetrics?.reduce(
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

  if (filters.platform) {
    postsCountQuery = postsCountQuery.eq("platform", filters.platform);
    prevPostsCountQuery = prevPostsCountQuery.eq("platform", filters.platform);
  }

  if (filters.socialAccountId) {
    postsCountQuery = postsCountQuery.eq("social_account_id", filters.socialAccountId);
    prevPostsCountQuery = prevPostsCountQuery.eq("social_account_id", filters.socialAccountId);
  }

  const [postsCountResult, prevPostsCountResult] = await Promise.all([
    postsCountQuery,
    prevPostsCountQuery
  ]);
  const postsCount = postsCountResult.count;
  const prevPostsCount = prevPostsCountResult.count;

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
    .select("id,external_post_id,social_account_id,created_at,caption,thumbnail_url,posted_at,metrics,url,platform,media_type")
    .eq("tenant_id", tenantId)
    .gte("posted_at", range.start.toISOString())
    .lte("posted_at", range.end.toISOString());

  if (filters.platform) {
    postsQuery = postsQuery.eq("platform", filters.platform);
  }

  if (filters.socialAccountId) {
    postsQuery = postsQuery.eq("social_account_id", filters.socialAccountId);
  }

  const { data: posts, error: postsError } = await postsQuery.order("posted_at", { ascending: false }).limit(100);
  if (postsError) {
    console.error("[dashboard] Failed to load posts", { tenantId, error: postsError });
  }

  const { data: collaboration, error: collaborationError } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining,notes,updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (collaborationError && collaborationError.code !== "PGRST116") {
    console.error("[dashboard] Failed to load collaboration", { tenantId, error: collaborationError });
  }

  const { data: shoots, error: shootsError } = await supabase
    .from("upcoming_shoots")
    .select("id,shoot_date,location,notes")
    .eq("tenant_id", tenantId)
    .order("shoot_date", { ascending: true });
  if (shootsError) {
    console.error("[dashboard] Failed to load shoots", { tenantId, error: shootsError });
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id,file_name,tag,pinned,created_at,file_path")
    .eq("tenant_id", tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (documentsError) {
    console.error("[dashboard] Failed to load documents", { tenantId, error: documentsError });
  }

  const { data: lastSync, error: syncError } = await supabase
    .from("sync_logs")
    .select("status,finished_at")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  if (syncError) {
    console.error("[dashboard] Failed to load sync logs", { tenantId, error: syncError });
  }

  // Notifications (best-effort)
  const [{ data: notifications }, { count: notificationsUnreadCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,title,message,metadata,is_read,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false),
  ]);

  // Use shared dedup+sort logic (same function used by PDF export)
  const sortedPosts = selectTopPosts((posts ?? []) as any[], (posts ?? []).length) as NonNullable<typeof posts>;

  const availablePlatforms = filters.platform
    ? [filters.platform]
    : params.platforms?.length
      ? params.platforms
      : Array.from(new Set((normalizedMetrics ?? []).map((row) => row.platform as Platform).filter(Boolean)));

  const buildPlatformStats = (platform: Platform) => {
    const currentRows = (normalizedMetrics ?? []).filter((row) => row.platform === platform);
    const prevRows = (normalizedPrevMetrics ?? []).filter((row) => row.platform === platform);
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
  if ((normalizedMetrics?.length ?? 0) === 0 && (posts?.length ?? 0) === 0) {
    console.warn("[dashboard] No metrics or posts found for range", {
      tenantId,
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString()
      },
      platform: filters.platform,
      socialAccountId: filters.socialAccountId
    });
  }

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
    const available = getDashboardMetricAvailability(item.platform, item.totals, item.prevTotals);

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
    metrics: normalizedMetrics ?? [],
    prevMetrics: normalizedPrevMetrics ?? [],
    posts: sortedPosts,
    perPlatform: platformSummaries,
    collaboration,
    shoots: shoots ?? [],
    documents: documents ?? [],
    lastSync,
    notifications: (notifications as any[]) ?? [],
    notificationsUnreadCount: notificationsUnreadCount ?? 0,
  };
}

export async function fetchDashboardAccounts(params: {
  profile: { id?: string; tenant_id: string | null; role?: string | null };
  tenantId?: string;
}) {
  const supabase = createSupabaseServerClient();
  const tenantId = await resolveActiveTenantId(params.profile as any, params.tenantId);
  if (!tenantId) {
    throw new Error("Aucun workspace selectionne.");
  }

  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select("id,platform,account_name,external_account_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dashboard] Failed to load social accounts", { tenantId, error });
    throw new Error("Impossible de charger les comptes sociaux.");
  }

  if ((accounts?.length ?? 0) === 0) {
    console.warn("[dashboard] No social accounts connected", { tenantId });
  }

  return accounts ?? [];
}

/**
 * Shared top posts selection: dedup by platform:external_post_id, sort by visibility+engagement, take top N.
 * Mirrors the exact dedup logic used in fetchDashboardData so the PDF and dashboard always agree.
 */
export function selectTopPosts<T extends {
  id?: string;
  external_post_id?: string | null;
  platform?: string | null;
  created_at?: string | null;
  metrics?: unknown;
  media_type?: string | null;
}>(posts: T[], limit: number): T[] {
  // Dedup by platform:external_post_id — keep the version with best metrics
  const byKey = new Map<string, T>();
  for (const post of posts) {
    const key = `${post.platform ?? ""}:${post.external_post_id ?? post.id ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, post);
      continue;
    }

    const postVis = getPostVisibility(post.metrics as any, post.media_type).value;
    const existingVis = getPostVisibility(existing.metrics as any, existing.media_type).value;
    const postImp = getPostImpressions(post.metrics as any);
    const existingImp = getPostImpressions(existing.metrics as any);
    const postEng = getPostEngagements(post.metrics as any);
    const existingEng = getPostEngagements(existing.metrics as any);
    const postCreatedAt = post.created_at ? new Date(post.created_at).getTime() : 0;
    const existingCreatedAt = existing.created_at ? new Date(existing.created_at).getTime() : 0;

    const shouldReplace =
      postVis > existingVis ||
      (postVis === existingVis && postImp > existingImp) ||
      (postVis === existingVis && postImp === existingImp && postEng > existingEng) ||
      (postVis === existingVis && postImp === existingImp && postEng === existingEng && postCreatedAt > existingCreatedAt);

    if (shouldReplace) {
      byKey.set(key, post);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      const aVis = getPostVisibility(a.metrics as any, a.media_type).value;
      const bVis = getPostVisibility(b.metrics as any, b.media_type).value;
      const aEng = getPostEngagements(a.metrics as any);
      const bEng = getPostEngagements(b.metrics as any);
      return bVis - aVis || bEng - aEng;
    })
    .slice(0, limit);
}
