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

  const queryString = new URLSearchParams({
    preset: preset,
    from: searchParams.from ?? "",
    to: searchParams.to ?? "",
    platform: searchParams.platform ?? "",
    view: searchParams.view ?? "",
    tenantId: searchParams.tenantId ?? "",
    accountId: searchParams.accountId ?? ""
  }).toString();

  const msDay = 24 * 60 * 60 * 1000;
  const offsetDays = data.range && data.prevRange
    ? Math.round((data.range.start.getTime() - data.prevRange.start.getTime()) / msDay)
    : null;
  const prevMap = new Map((data.prevMetrics ?? []).map((row) => [row.date, row]));

  const shiftDate = (dateStr: string, days: number) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const withPrev = (date: string, key: "followers" | "views" | "engagements" | "reach") => {
    if (!offsetDays) return undefined;
    const prevDate = shiftDate(date, offsetDays);
    return prevMap.get(prevDate)?.[key] ?? 0;
  };

  const trendFollowers = data.metrics.map((item) => ({
    date: item.date,
    value: item.followers ?? 0,
    previousValue: withPrev(item.date, "followers")
  }));
  const trendViews = data.metrics.map((item) => ({
    date: item.date,
    value: item.views ?? 0,
    previousValue: withPrev(item.date, "views")
  }));
  const trendEngagements = data.metrics.map((item) => ({
    date: item.date,
    value: item.engagements ?? 0,
    previousValue: withPrev(item.date, "engagements")
  }));
  const trendReach = data.metrics.map((item) => ({
    date: item.date,
    value: item.reach ?? 0,
    previousValue: withPrev(item.date, "reach")
  }));

  const showViews = data.perPlatform.some((item) => item.available.views);
  const showReach = data.perPlatform.some((item) => item.available.reach);
  const showEngagements = data.perPlatform.some((item) => item.available.engagements);
  const insights = generateInsights({ totals: data.totals, delta: data.delta });
  const showComparison = Boolean(offsetDays && (data.prevMetrics?.length ?? 0) > 0);
  const view = searchParams.view ?? "all";
  const showOrganic = view !== "ads";
  const showAds = view !== "organic";

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
            metrics={data.metrics}
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
