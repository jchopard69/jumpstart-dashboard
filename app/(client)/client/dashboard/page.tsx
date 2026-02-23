import type { Metadata } from "next";
import { getSessionProfile } from "@/lib/auth";
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
import { DailyMetricsTable } from "@/components/dashboard/daily-metrics-table";
import { InsightCard } from "@/components/dashboard/insight-card";
import { ScoreCard } from "@/components/dashboard/score-card";
import { ContentDnaCard } from "@/components/dashboard/content-dna-card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeJumpStartScore, type ScoreInput } from "@/lib/scoring";
import { generateStrategicInsights, generateKeyTakeaways, generateExecutiveSummary, type InsightsInput } from "@/lib/insights";
import { analyzeContentDna, type ContentDnaInput } from "@/lib/content-dna";

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

  const preset = (searchParams.preset ?? "last_30_days") as any;
  const accounts = await fetchDashboardAccounts({ profile, tenantId: searchParams.tenantId });
  const platformList = Array.from(new Set(accounts.map((account) => account.platform)));

  const data = await fetchDashboardData({
    preset,
    from: searchParams.from,
    to: searchParams.to,
    platform: (searchParams.platform as any) ?? "all",
    socialAccountId: searchParams.accountId,
    platforms: platformList,
    profile,
    tenantId: searchParams.tenantId
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

  // Aggregate metrics by date (sum across platforms)
  const aggregateByDate = (metrics: typeof data.metrics) => {
    const byDate = new Map<string, { followers: number; views: number; engagements: number; reach: number }>();
    for (const row of metrics) {
      const existing = byDate.get(row.date) ?? { followers: 0, views: 0, engagements: 0, reach: 0 };
      existing.followers += row.followers ?? 0;
      existing.views += row.views ?? 0;
      existing.engagements += row.engagements ?? 0;
      existing.reach += row.reach ?? 0;
      byDate.set(row.date, existing);
    }
    return byDate;
  };

  const aggregatedMetrics = aggregateByDate(data.metrics);
  const aggregatedPrevMetrics = aggregateByDate(data.prevMetrics ?? []);

  const shiftDate = (dateStr: string, days: number) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const withPrev = (date: string, key: "followers" | "views" | "engagements" | "reach") => {
    if (!offsetDays) return undefined;
    const prevDate = shiftDate(date, offsetDays);
    return aggregatedPrevMetrics.get(prevDate)?.[key] ?? 0;
  };

  // Build trend data from aggregated metrics (sorted by date)
  const sortedDates = Array.from(aggregatedMetrics.keys()).sort();
  const trendFollowers = sortedDates.map((date) => ({
    date,
    value: aggregatedMetrics.get(date)?.followers ?? 0,
    previousValue: withPrev(date, "followers")
  }));
  const trendViews = sortedDates.map((date) => ({
    date,
    value: aggregatedMetrics.get(date)?.views ?? 0,
    previousValue: withPrev(date, "views")
  }));
  const trendEngagements = sortedDates.map((date) => ({
    date,
    value: aggregatedMetrics.get(date)?.engagements ?? 0,
    previousValue: withPrev(date, "engagements")
  }));
  const trendReach = sortedDates.map((date) => ({
    date,
    value: aggregatedMetrics.get(date)?.reach ?? 0,
    previousValue: withPrev(date, "reach")
  }));

  // Build aggregated metrics array for the daily table
  const aggregatedMetricsArray = sortedDates.map((date) => ({
    date,
    followers: aggregatedMetrics.get(date)?.followers ?? 0,
    views: aggregatedMetrics.get(date)?.views ?? 0,
    reach: aggregatedMetrics.get(date)?.reach ?? 0,
    engagements: aggregatedMetrics.get(date)?.engagements ?? 0,
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
          : "mailto:contact@jumpstartstudio.fr"
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
  // Get previous followers from data.delta
  const prevFollowers = data.delta.followers !== 0 && data.totals?.followers
    ? Math.round(data.totals.followers / (1 + data.delta.followers / 100))
    : data.totals?.followers ?? 0;
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
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium">Social Intelligence</p>
              <h1 className="page-heading">Vue d&apos;ensemble</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Analyse consolidée de votre présence digitale.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RefreshButton tenantId={searchParams.tenantId} />
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
          <EmptyState
            title={!hasAccounts ? "Aucun compte connecté" : "Aucune donnée sur la période"}
            description={
              !hasAccounts
                ? "Connectez un compte social pour voir apparaître vos statistiques. L'analyse de vos performances commencera immédiatement."
                : "Essayez d'élargir la période sélectionnée ou relancez la synchronisation pour mettre à jour les données."
            }
            action={emptyStateAction}
          />
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

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium">Social Intelligence</p>
            <h1 className="page-heading">Vue d&apos;ensemble</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Analyse consolidee — <span className="font-medium text-foreground/70">{periodLabel}</span>
              {platformList.length > 0 && (
                <span> · {platformList.length} plateforme{platformList.length > 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton tenantId={searchParams.tenantId} />
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

      {/* JumpStart Score */}
      <ScoreCard
        score={jumpStartScore}
        takeaways={keyTakeaways}
        executiveSummary={executiveSummary}
      />

      <KpiSection
        totals={data.totals}
        delta={data.delta}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
      />

      {/* Insights + Content DNA + Collaboration */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InsightCard insights={strategicInsights.map(i => ({
          type: i.type === "opportunity" || i.type === "recommendation" ? "positive" : i.type as any,
          title: i.title,
          description: i.description,
        }))} />
        <ContentDnaCard dna={contentDna} />
      </section>

      {/* Charts */}
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

      {/* Top Posts — full width */}
      <TopPosts posts={data.posts.slice(0, 10)} />

      {/* Platform breakdown — full width */}
      <PlatformTable
        perPlatform={data.perPlatform}
        showViews={showViews}
        showReach={showReach}
        showEngagements={showEngagements}
      />

      <SyncStatus lastSync={data.lastSync} range={data.range} metrics={data.metrics} />

      {/* Collaboration — full width */}
      <CollaborationCard
        collaboration={data.collaboration}
        shoots={data.shoots}
        documents={data.documents}
      />

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
