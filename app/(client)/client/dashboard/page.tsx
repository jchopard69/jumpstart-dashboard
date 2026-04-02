import type { Metadata } from "next";
import { getSessionProfile, getUserTenants } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { KpiSection } from "@/components/dashboard/kpi-section";
import { ChartsSection } from "@/components/dashboard/charts-section";
import { PlatformTable } from "@/components/dashboard/platform-table";
import { TopPosts } from "@/components/dashboard/top-posts";
import { CollaborationCard } from "@/components/dashboard/collaboration-card";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { NotificationsCard } from "@/components/dashboard/notifications-card";
import { DailyMetricsTable } from "@/components/dashboard/daily-metrics-table";
import { InsightCard } from "@/components/dashboard/insight-card";
import { ScoreCard } from "@/components/dashboard/score-card";
import { ContentDnaCard } from "@/components/dashboard/content-dna-card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeJumpStartScore, type ScoreInput } from "@/lib/scoring";
import { generateStrategicInsights, generateKeyTakeaways, generateExecutiveSummary, type InsightsInput } from "@/lib/insights";
import { analyzeContentDna, type ContentDnaInput } from "@/lib/content-dna";
import { fetchScoreHistory } from "@/lib/score-history";
import { analyzeBestTime } from "@/lib/best-time";
import { fetchTenantGoals } from "@/lib/goals";
import { ScoreTrend } from "@/components/dashboard/score-trend";
import { BestTimeHeatmap } from "@/components/dashboard/best-time-heatmap";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getDemoContactHref } from "@/lib/demo";
import { getSupportContactHref } from "@/lib/support";
import { toIsoDate } from "@/lib/date";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Tableau de bord"
};

export default async function ClientDashboardPage({
  searchParams
}: {
  searchParams: {
    preset?: string;
    from?: string;
    to?: string;
    platform?: string;
    tenantId?: string;
    accountId?: string;
  };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin" && !searchParams.tenantId) {
    redirect("/admin");
  }

  const tenantAccess = profile.role === "agency_admin" ? [] : await getUserTenants(profile.id);
  const cookieStore = cookies();
  const cookieTenantId = cookieStore.get("active_tenant_id")?.value;
  const fallbackTenantId =
    searchParams.tenantId ||
    ((cookieTenantId && tenantAccess.some((t) => t.id === cookieTenantId))
      ? cookieTenantId
      : profile.tenant_id || tenantAccess[0]?.id || "");
  let isDemoTenant = Boolean(tenantAccess.find((tenant) => tenant.id === fallbackTenantId)?.is_demo);
  if (profile.role === "agency_admin" && searchParams.tenantId) {
    const supabase = createSupabaseServiceClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("is_demo")
      .eq("id", searchParams.tenantId)
      .maybeSingle();
    isDemoTenant = Boolean(tenant?.is_demo);
  }

  const preset = (searchParams.preset ?? "last_30_days") as any;
  const effectiveTenantId = profile.role === "agency_admin" ? searchParams.tenantId : fallbackTenantId;
  const accounts = await fetchDashboardAccounts({ profile, tenantId: effectiveTenantId });
  const platformList = Array.from(new Set(accounts.map((account) => account.platform)));

  const data = await fetchDashboardData({
    preset,
    from: searchParams.from,
    to: searchParams.to,
    platform: (searchParams.platform as any) ?? "all",
    socialAccountId: searchParams.accountId,
    platforms: platformList,
    profile,
    tenantId: effectiveTenantId
  });

  // Build query string, excluding empty values
  const queryParams = new URLSearchParams();
  queryParams.set("preset", preset);
  if (searchParams.from) queryParams.set("from", searchParams.from);
  if (searchParams.to) queryParams.set("to", searchParams.to);
  if (searchParams.platform) queryParams.set("platform", searchParams.platform);
  if (searchParams.tenantId) queryParams.set("tenantId", searchParams.tenantId);
  if (searchParams.accountId) queryParams.set("accountId", searchParams.accountId);
  const queryString = queryParams.toString();

  const msDay = 24 * 60 * 60 * 1000;
  const offsetDays = data.range && data.prevRange
    ? Math.round((data.range.start.getTime() - data.prevRange.start.getTime()) / msDay)
    : null;

  // Build a full date list so charts don't have holes when some days are missing in DB.
  const toDateKey = (d: Date) => toIsoDate(d);
  const parseDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  };
  const buildDateKeysInclusive = (start: Date, end: Date) => {
    const keys: string[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      keys.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  };

  // Aggregate daily flow metrics by date (sum across platforms). For followers, we build a forward-filled
  // series per account so we don't undercount when a platform misses a day.
  const aggregateFlowsByDate = (metrics: typeof data.metrics) => {
    const byDate = new Map<string, { views: number; engagements: number; reach: number }>();
    for (const row of metrics) {
      const date = row.date;
      if (!date) continue;
      const existing = byDate.get(date) ?? { views: 0, engagements: 0, reach: 0 };
      existing.views += row.views ?? 0;
      existing.engagements += row.engagements ?? 0;
      existing.reach += row.reach ?? 0;
      byDate.set(date, existing);
    }
    return byDate;
  };

  const buildFollowersTotalByDate = (metrics: typeof data.metrics, dateKeys: string[]) => {
    // Build time series per social_account_id
    const perAccount = new Map<string, Array<{ date: string; followers: number }>>();
    for (const row of metrics) {
      if (!row.social_account_id || !row.date) continue;
      const key = String(row.social_account_id);
      const arr = perAccount.get(key) ?? [];
      arr.push({ date: row.date, followers: row.followers ?? 0 });
      perAccount.set(key, arr);
    }

    // Sort each series by date asc
    for (const arr of perAccount.values()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Forward fill across the requested dateKeys and sum across accounts
    const totalByDate = new Map<string, number>();
    const cursors = new Map<string, { idx: number; last: number }>();
    for (const accountId of perAccount.keys()) {
      cursors.set(accountId, { idx: 0, last: 0 });
    }

    for (const date of dateKeys) {
      let total = 0;
      for (const [accountId, series] of perAccount.entries()) {
        const cursor = cursors.get(accountId)!;
        while (cursor.idx < series.length && series[cursor.idx].date <= date) {
          cursor.last = series[cursor.idx].followers;
          cursor.idx++;
        }
        total += cursor.last;
      }
      totalByDate.set(date, total);
    }

    return totalByDate;
  };

  const shiftDate = (dateStr: string, days: number) => {
    const date = parseDateKey(dateStr);
    date.setDate(date.getDate() - days);
    return toDateKey(date);
  };

  const dateKeys = data.range ? buildDateKeysInclusive(data.range.start, data.range.end) : [];

  const aggregatedFlows = aggregateFlowsByDate(data.metrics);
  const aggregatedPrevFlows = aggregateFlowsByDate(data.prevMetrics ?? []);
  const followersByDate = buildFollowersTotalByDate(data.metrics, dateKeys);
  const prevFollowersByDate = offsetDays && data.prevRange
    ? buildFollowersTotalByDate(data.prevMetrics ?? [], buildDateKeysInclusive(data.prevRange.start, data.prevRange.end))
    : new Map<string, number>();

  const withPrev = (date: string, key: "followers" | "views" | "engagements" | "reach") => {
    if (!offsetDays) return undefined;
    const prevDate = shiftDate(date, offsetDays);
    if (key === "followers") return prevFollowersByDate.get(prevDate) ?? 0;
    if (key === "views") return aggregatedPrevFlows.get(prevDate)?.views ?? 0;
    if (key === "reach") return aggregatedPrevFlows.get(prevDate)?.reach ?? 0;
    return aggregatedPrevFlows.get(prevDate)?.engagements ?? 0;
  };

  // Build trend data from a full date list (no missing days)
  const sortedDates = dateKeys.length ? dateKeys : Array.from(aggregatedFlows.keys()).sort();

  const trendFollowers = sortedDates.map((date) => ({
    date,
    value: followersByDate.get(date) ?? 0,
    previousValue: withPrev(date, "followers")
  }));
  const trendViews = sortedDates.map((date) => ({
    date,
    value: aggregatedFlows.get(date)?.views ?? 0,
    previousValue: withPrev(date, "views")
  }));
  const trendEngagements = sortedDates.map((date) => ({
    date,
    value: aggregatedFlows.get(date)?.engagements ?? 0,
    previousValue: withPrev(date, "engagements")
  }));
  const trendReach = sortedDates.map((date) => ({
    date,
    value: aggregatedFlows.get(date)?.reach ?? 0,
    previousValue: withPrev(date, "reach")
  }));

  // Build aggregated metrics array for the daily table
  const aggregatedMetricsArray = sortedDates.map((date) => ({
    date,
    followers: followersByDate.get(date) ?? 0,
    views: aggregatedFlows.get(date)?.views ?? 0,
    reach: aggregatedFlows.get(date)?.reach ?? 0,
    engagements: aggregatedFlows.get(date)?.engagements ?? 0,
  }));

  const showViews = data.perPlatform.some((item) => item.available.views);
  const showReach = data.perPlatform.some((item) => item.available.reach);
  const showEngagements = data.perPlatform.some((item) => item.available.engagements);
  const showComparison = Boolean(offsetDays && (data.prevMetrics?.length ?? 0) > 0);

  const hasAnyMetrics =
    (data.metrics?.length ?? 0) > 0 ||
    (data.posts?.length ?? 0) > 0 ||
    (data.totals?.followers ?? 0) > 0 ||
    (data.totals?.posts_count ?? 0) > 0;
  const hasAccounts = accounts.length > 0;
  const showEmptyState = !hasAccounts || !hasAnyMetrics;
  const emptyStateAction = !hasAccounts
    ? {
        label: profile.role === "agency_admin" && searchParams.tenantId
          ? "Connecter un compte"
          : "Contacter votre administrateur",
        href: profile.role === "agency_admin" && searchParams.tenantId
          ? `/admin/clients/${searchParams.tenantId}`
          : getSupportContactHref("Besoin d'acces au dashboard JumpStart OS")
      }
    : {
        label: "Choisir une période",
        href: "#dashboard-filters"
      };

  // Compute JumpStart Score
  const periodDays = data.range
    ? Math.max(1, Math.round((data.range.end.getTime() - data.range.start.getTime()) / msDay))
    : 30;

  const prevTotals = (data.prevMetrics ?? []).reduce(
    (acc, row) => {
      acc.views += row.views ?? 0;
      acc.reach += row.reach ?? 0;
      acc.engagements += row.engagements ?? 0;
      return acc;
    },
    { followers: 0, views: 0, reach: 0, engagements: 0, postsCount: 0 }
  );
  // Compute prevFollowers directly from prevMetrics (latest per account)
  const prevFollowersMap = new Map<string, { date: string; followers: number }>();
  for (const row of data.prevMetrics ?? []) {
    if (!row.social_account_id || !row.date) continue;
    const existing = prevFollowersMap.get(row.social_account_id);
    if (!existing || row.date > existing.date) {
      prevFollowersMap.set(row.social_account_id, { date: row.date, followers: row.followers ?? 0 });
    }
  }
  let prevFollowers = 0;
  for (const entry of prevFollowersMap.values()) prevFollowers += entry.followers;
  if (prevFollowers === 0) prevFollowers = data.totals?.followers ?? 0;
  prevTotals.followers = prevFollowers;

  const scoreInput: ScoreInput = {
    followers: data.totals?.followers ?? 0,
    views: data.totals?.views ?? 0,
    reach: data.totals?.reach ?? 0,
    engagements: data.totals?.engagements ?? 0,
    postsCount: data.totals?.posts_count ?? 0,
    prevFollowers: prevTotals.followers,
    prevViews: prevTotals.views,
    prevReach: prevTotals.reach,
    prevEngagements: prevTotals.engagements,
    prevPostsCount: prevTotals.postsCount,
    periodDays,
  };
  const jumpStartScore = computeJumpStartScore(scoreInput);

  // Generate strategic insights
  const insightsInput: InsightsInput = {
    totals: {
      followers: data.totals?.followers ?? 0,
      views: data.totals?.views ?? 0,
      reach: data.totals?.reach ?? 0,
      engagements: data.totals?.engagements ?? 0,
      postsCount: data.totals?.posts_count ?? 0,
    },
    prevTotals: {
      followers: prevTotals.followers,
      views: prevTotals.views,
      reach: prevTotals.reach,
      engagements: prevTotals.engagements,
      postsCount: prevTotals.postsCount,
    },
    platforms: data.perPlatform.map(p => ({
      platform: p.platform,
      totals: p.totals,
      delta: p.delta ?? { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 },
    })),
    posts: data.posts.map(p => ({
      platform: p.platform as any,
      media_type: (p as any).media_type,
      posted_at: p.posted_at,
      metrics: p.metrics as any,
    })),
    score: jumpStartScore,
    periodDays,
  };
  const strategicInsights = generateStrategicInsights(insightsInput);
  const keyTakeaways = generateKeyTakeaways(insightsInput);
  const executiveSummary = generateExecutiveSummary(insightsInput);

  // Content DNA
  const contentDnaInput: ContentDnaInput = {
    posts: data.posts.map(p => ({
      platform: p.platform as any,
      media_type: (p as any).media_type,
      posted_at: p.posted_at,
      caption: p.caption,
      metrics: p.metrics as any,
    })),
  };
  const contentDna = analyzeContentDna(contentDnaInput);

  // Resolve tenant ID for additional data fetches
  const resolvedTenantId = effectiveTenantId || profile.tenant_id || "";

  // Fetch score history, best time analysis, and goals in parallel
  const [scoreHistory, goals] = await Promise.all([
    resolvedTenantId ? fetchScoreHistory(resolvedTenantId) : Promise.resolve([]),
    resolvedTenantId ? fetchTenantGoals(resolvedTenantId) : Promise.resolve(null),
  ]);

  const bestTimeData = analyzeBestTime(data.posts, searchParams.platform);

  // Detect if metrics are missing (account connected but no insights data)
  const hasFollowersOrPosts = (data.totals?.followers ?? 0) > 0 || (data.totals?.posts_count ?? 0) > 0;
  const hasInsightsData = (data.totals?.views ?? 0) > 0 || (data.totals?.reach ?? 0) > 0 || (data.totals?.engagements ?? 0) > 0;
  const showMissingDataWarning = hasFollowersOrPosts && !hasInsightsData && data.perPlatform.length > 0;

  if (showEmptyState) {
    return (
      <div className="space-y-8 fade-in">
        <section className="surface-panel p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="section-label">Social Intelligence</p>
              <h1 className="page-heading mt-1">Vue d&apos;ensemble</h1>
              <p className="mt-2 text-sm text-muted-foreground">Analyse consolidée de votre présence digitale.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RefreshButton tenantId={effectiveTenantId} />
              <ExportButtons query={queryString} />
            </div>
          </div>
          <div className="mt-6" id="dashboard-filters">
            <DashboardFilters
              preset={preset}
              from={searchParams.from}
              to={searchParams.to}
              platform={searchParams.platform}
              accountId={searchParams.accountId}
              accounts={accounts}
            />
          </div>
        </section>

        <section className="surface-panel p-12">
          {!hasAccounts ? (
            <div className="max-w-lg mx-auto text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Connectez votre premier compte</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  En 3 étapes, accédez à l&apos;analyse complète de vos performances digitales.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">1</div>
                  <p className="mt-2 text-sm font-medium">Connecter</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Liez vos comptes Instagram, LinkedIn, TikTok...</p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">2</div>
                  <p className="mt-2 text-sm font-medium">Synchroniser</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Vos données sont récupérées automatiquement.</p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">3</div>
                  <p className="mt-2 text-sm font-medium">Analyser</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Score, insights et recommandations personnalisées.</p>
                </div>
              </div>
              {emptyStateAction.href && (
                <a
                  href={emptyStateAction.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-colors"
                >
                  {emptyStateAction.label}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <EmptyState
              title="Aucune donnée sur la période"
              description="Essayez d'élargir la période sélectionnée ou relancez la synchronisation pour mettre à jour les données."
              action={emptyStateAction}
            />
          )}
        </section>
      </div>
    );
  }

  // Build period label for context
  const periodLabel = (() => {
    const labels: Record<string, string> = {
      last_7_days: "7 derniers jours",
      last_30_days: "30 derniers jours",
      last_90_days: "90 derniers jours",
      last_365_days: "12 derniers mois",
      this_month: "ce mois-ci",
      last_month: "le mois dernier",
    };
    if (preset === "custom" && data.range) {
      return `du ${data.range.start.toLocaleDateString("fr-FR")} au ${data.range.end.toLocaleDateString("fr-FR")}`;
    }
    return labels[preset] ?? "30 derniers jours";
  })();

  // Build comparison label (previous equivalent period)
  const comparisonLabel = (() => {
    const labels: Record<string, string> = {
      last_7_days: "les 7 jours précédents",
      last_30_days: "les 30 jours précédents",
      last_90_days: "les 90 jours précédents",
      last_365_days: "les 12 mois précédents",
      this_month: "le mois précédent",
      last_month: "le mois d'avant",
    };
    if (preset === "custom" && data.range) {
      return "la période précédente équivalente";
    }
    return labels[preset] ?? "la période précédente";
  })();

  return (
    <div className="space-y-10 fade-in">
      {/* ─── Header + Filters ─── */}
      <section className="surface-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
          <div>
            <p className="section-label">Social Intelligence</p>
            <h1 className="page-heading mt-1">Vue d&apos;ensemble</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Analyse consolidée — <span className="font-medium text-foreground/70">{periodLabel}</span>
              {platformList.length > 0 && (
                <span> · {platformList.length} plateforme{platformList.length > 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton tenantId={effectiveTenantId} />
            <ExportButtons query={queryString} />
          </div>
        </div>
        <div className="mt-6" id="dashboard-filters">
          <DashboardFilters
            preset={preset}
            from={searchParams.from}
            to={searchParams.to}
            platform={searchParams.platform}
            accountId={searchParams.accountId}
            accounts={accounts}
          />
        </div>
      </section>

      {isDemoTenant && (
        <section className="rounded-2xl border border-amber-200/70 bg-amber-50/85 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Mode démo</p>
              <p className="mt-1 text-sm text-amber-900">
                Ce workspace utilise des données fictives premium, anonymisées et non contractuelles.
              </p>
            </div>
            <a
              href={getDemoContactHref()}
              className="text-sm font-semibold text-amber-800 underline underline-offset-4"
            >
              Demander une démo personnalisée
            </a>
          </div>
        </section>
      )}

      {showMissingDataWarning && (
        <section className="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Données d&apos;insights manquantes</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Le compte est connecté mais les métriques de portée, vues et engagements ne sont pas disponibles.
                Essayez de reconnecter le compte dans les paramètres admin.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ─── Score + KPIs ─── */}
      <ScoreCard
        score={jumpStartScore}
        takeaways={keyTakeaways}
        executiveSummary={executiveSummary}
        dataCoverage={(() => {
          if (!data.range) return null;
          const totalDays = Math.max(1, Math.ceil((data.range.end.getTime() - data.range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const uniqueDays = new Set(data.metrics.map(r => r.date)).size;
          return Math.round((uniqueDays / totalDays) * 100);
        })()}
        postsAnalyzed={data.posts.length}
      />

      <KpiSection
        totals={data.totals}
        delta={data.delta}
        goals={goals}
        metrics={data.metrics}
        comparisonLabel={comparisonLabel}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
      />

      {/* ─── Strategic Analysis ─── */}
      <div className="section-divider" />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <InsightCard insights={strategicInsights.map(i => ({
          type: i.type as any,
          title: i.title,
          description: i.description,
        }))} />
        <ContentDnaCard dna={contentDna} />
      </section>

      {/* ─── Score Trend ─── */}
      <ScoreTrend history={scoreHistory} />

      {/* ─── Trends ─── */}
      <div className="section-divider" />

      <ChartsSection
        trendFollowers={trendFollowers}
        trendViews={trendViews}
        trendEngagements={trendEngagements}
        trendReach={trendReach}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
        showComparison={showComparison}
      />

      {/* ─── Content Strategy: Top Posts + Best Time ─── */}
      <div className="section-divider" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopPosts posts={data.posts.slice(0, 10)} />
        {bestTimeData && <BestTimeHeatmap data={bestTimeData} />}
      </div>

      <PlatformTable
        perPlatform={data.perPlatform}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
      />

      {/* ─── Operations ─── */}
      <div className="section-divider" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SyncStatus lastSync={data.lastSync} range={data.range} metrics={data.metrics} />
          {data.notifications && data.notifications.length > 0 && (
            <NotificationsCard
              notifications={data.notifications as any}
              unreadCount={data.notificationsUnreadCount ?? 0}
              tenantId={effectiveTenantId}
            />
          )}
        </div>
        <CollaborationCard
          collaboration={data.collaboration}
          shoots={data.shoots}
          documents={data.documents}
        />
      </div>

      <DailyMetricsTable
        metrics={aggregatedMetricsArray}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
