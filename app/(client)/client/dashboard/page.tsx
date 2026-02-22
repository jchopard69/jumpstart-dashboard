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
import { AdsSummary } from "@/components/dashboard/ads-summary";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { DailyMetricsTable } from "@/components/dashboard/daily-metrics-table";
import { InsightCard, generateInsights } from "@/components/dashboard/insight-card";
import { Badge } from "@/components/ui/badge";

export default async function ClientDashboardPage({
  searchParams
}: {
  searchParams: {
    preset?: string;
    from?: string;
    to?: string;
    platform?: string;
    view?: string;
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
  if (searchParams.view) queryParams.set("view", searchParams.view);
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
  const insights = generateInsights({ totals: data.totals, delta: data.delta });
  const showComparison = Boolean(offsetDays && (data.prevMetrics?.length ?? 0) > 0);
  const view = searchParams.view ?? "all";
  const showOrganic = view !== "ads";
  const showAds = view !== "organic";

  // Detect if metrics are missing (account connected but no insights data)
  const hasFollowersOrPosts = (data.totals?.followers ?? 0) > 0 || (data.totals?.posts_count ?? 0) > 0;
  const hasInsightsData = (data.totals?.views ?? 0) > 0 || (data.totals?.reach ?? 0) > 0 || (data.totals?.engagements ?? 0) > 0;
  const showMissingDataWarning = hasFollowersOrPosts && !hasInsightsData && data.perPlatform.length > 0;

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Rapport social media</p>
            <h1 className="page-heading">Performance</h1>
            <p className="mt-2 text-sm text-muted-foreground">Synthèse multi-plateformes sur la période sélectionnée.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RefreshButton tenantId={searchParams.tenantId} />
            {showOrganic && <ExportButtons query={queryString} />}
          </div>
        </div>
        <div className="mt-6">
          <DashboardFilters
            preset={preset}
            from={searchParams.from}
            to={searchParams.to}
            platform={searchParams.platform}
            view={searchParams.view}
            accountId={searchParams.accountId}
            accounts={accounts}
          />
        </div>
      </section>

      {showOrganic && (
        <>
          <section className="flex items-center gap-3">
            <Badge variant="secondary">Organique</Badge>
            <p className="text-sm text-muted-foreground">Performance des contenus non sponsorisés.</p>
          </section>

          {showMissingDataWarning && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Données d&apos;insights manquantes</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Le compte est connecté mais les métriques de portée, vues et engagements ne sont pas disponibles.
                    Cela peut être dû à des permissions manquantes. Essayez de reconnecter le compte dans les paramètres admin.
                  </p>
                </div>
              </div>
            </section>
          )}

          <KpiSection
            totals={data.totals}
            delta={data.delta}
            showViews={showViews}
            showReach={showReach}
            showEngagements={showEngagements}
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <InsightCard insights={insights} />
            <CollaborationCard
              collaboration={data.collaboration}
              shoots={data.shoots}
              documents={data.documents}
            />
          </section>

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

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TopPosts posts={data.posts} />
            <div className="lg:col-span-2 space-y-4">
              <PlatformTable
                perPlatform={data.perPlatform}
                showViews={showViews}
                showReach={showReach}
                showEngagements={showEngagements}
              />
              <SyncStatus lastSync={data.lastSync} range={data.range} metrics={data.metrics} />
            </div>
          </section>

          <DailyMetricsTable
            metrics={aggregatedMetricsArray}
            showViews={showViews}
            showReach={showReach}
            showEngagements={showEngagements}
          />

          {showAds && (
            <>
              <section className="flex items-center gap-3">
                <Badge variant="secondary">Ads</Badge>
                <p className="text-sm text-muted-foreground">Performances sponsorisées sur la période.</p>
              </section>
              <AdsSummary ads={data.ads} />
            </>
          )}
        </>
      )}

      {!showOrganic && showAds && (
        <>
          <section className="flex items-center gap-3">
            <Badge variant="secondary">Ads</Badge>
            <p className="text-sm text-muted-foreground">Résultats sponsorisés uniquement.</p>
          </section>
          <AdsSummary ads={data.ads} />
        </>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
