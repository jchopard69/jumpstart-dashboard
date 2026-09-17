import { analyzeBestTime } from "@/lib/best-time";
import { MonthlyWorkspace } from "@/components/review/monthly-workspace";
import { normalizeReviewPost } from "@/lib/monthly-review";
import { MonthlyPeriodPicker } from "@/components/review/monthly-period-picker";
import { DataQualityCard } from "@/components/dashboard/data-quality-card";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { computeDashboardDataQuality } from "@/lib/dashboard-data-quality";
import { computeJumpStartScore } from "@/lib/scoring";
import { countCalendarDays, toIsoDate } from "@/lib/date";
import type { Metadata } from "next";
import { getSessionProfile, getUserTenants } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Bilan social media"
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
  let tenantName = tenantAccess.find(tenant => tenant.id === fallbackTenantId)?.name ?? "Votre espace";
  let isDemoTenant = Boolean(tenantAccess.find((tenant) => tenant.id === fallbackTenantId)?.is_demo);
  if (profile.role === "agency_admin" && searchParams.tenantId) {
    const supabase = createSupabaseServiceClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("is_demo,name")
      .eq("id", searchParams.tenantId)
      .maybeSingle();
    isDemoTenant = Boolean(tenant?.is_demo);
    tenantName = tenant?.name ?? tenantName;
  }

  const preset = (searchParams.preset ?? "last_month") as any;
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

  const selectedAccounts = accounts.filter(account => data.perPlatform.some(item => item.platform === account.platform) && (!searchParams.accountId || searchParams.accountId === "all" || account.id === searchParams.accountId));
  const quality = computeDashboardDataQuality({ range: data.range, accounts: selectedAccounts, metrics: data.metrics, perPlatform: data.perPlatform, lastSync: data.lastSync });
  const previousQuality = computeDashboardDataQuality({ range: data.prevRange, accounts: selectedAccounts, metrics: data.prevMetrics, perPlatform: data.perPlatform.map(p=>({...p,totals:p.prevTotals})), lastSync: data.lastSync });
  const channels = data.perPlatform.map(channel => ({ ...channel, hasCurrent: data.metrics.some(row=>row.platform===channel.platform), hasPrevious: data.prevMetrics.some(row=>row.platform===channel.platform), coverage: quality.platformQuality.find(q=>q.platform===channel.platform)?.coverage ?? 0, previousCoverage: previousQuality.platformQuality.find(q=>q.platform===channel.platform)?.coverage ?? 0 }));
  const current = data.totals; const previous = data.prevTotals;
  const score = data.metrics.length ? computeJumpStartScore({followers:current.followers,views:current.views,reach:current.reach,engagements:current.engagements,postsCount:current.posts_count,prevFollowers:previous.followers,prevViews:previous.views,prevReach:previous.reach,prevEngagements:previous.engagements,prevPostsCount:previous.posts_count,periodDays:countCalendarDays(data.range)}) : null;
  const label=(range:{start:Date;end:Date})=>`${range.start.toLocaleDateString('fr-FR')} — ${range.end.toLocaleDateString('fr-FR')}`;
  return <MonthlyWorkspace key={queryString} period={label(data.range)} previousPeriod={label(data.prevRange)} from={toIsoDate(data.range.start)} to={toIsoDate(data.range.end)} channels={channels} posts={data.posts.map(normalizeReviewPost)} rows={data.metrics} previousRows={data.prevMetrics} score={score} bestTimes={channels.flatMap(channel => { const result = analyzeBestTime(data.posts, channel.platform); return result ? [result] : []; })}
    header={<header className="review-header"><div className="review-header-top"><div><p className="review-eyebrow">JumpStart / Reporting</p><h1>{tenantName}<span className="review-title-caption">Votre bilan social media.</span></h1><p>Vos résultats et les contenus qui les accompagnent.</p></div><div className="review-actions"><RefreshButton tenantId={effectiveTenantId}/><ExportButtons query={queryString}/></div></div><MonthlyPeriodPicker from={toIsoDate(data.range.start)} to={toIsoDate(data.range.end)} /><details className="review-advanced"><summary>Filtres avancés · réseau, compte ou dates libres</summary><DashboardFilters preset={preset} from={searchParams.from} to={searchParams.to} platform={searchParams.platform} accountId={searchParams.accountId} accounts={accounts}/></details>{isDemoTenant&&<p className="review-notice">Données de démonstration.</p>}{!accounts.length&&<p className="review-notice">Aucun compte connecté. Connectez un compte depuis l’administration pour alimenter ce bilan.</p>}</header>}
    sources={<div className="space-y-6"><DataQualityCard quality={quality}/><SyncStatus lastSync={data.lastSync} range={data.range} metrics={data.metrics}/><div className="review-small"><h3>Définitions des plateformes</h3><p>Les conseils éditoriaux sont des pistes issues de vos résultats. Les systèmes de recommandation sont personnalisés et ne fournissent pas une explication causale de chaque performance.</p><div className="flex flex-wrap gap-4 mt-3"><a className="review-text-button" href="https://ai.meta.com/tools/system-cards/instagram-feed-ranking/" target="_blank" rel="noreferrer">Classement du fil Instagram · Meta</a><a className="review-text-button" href="https://www.linkedin.com/help/linkedin/answer/a564051" target="_blank" rel="noreferrer">Statistiques de page · LinkedIn</a><a className="review-text-button" href="https://support.google.com/youtube/answer/9314415?hl=fr" target="_blank" rel="noreferrer">Rétention vidéo · YouTube</a></div></div><p className="review-small">Les statistiques des comptes portent sur les dates choisies. Celles des contenus sont des cumuls à leur dernière collecte. Le mois civil précédent est utilisé pour les bilans mensuels, même lorsque sa durée diffère.</p></div>}
  />;
}
export const dynamic = "force-dynamic";
