import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, assertTenant } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchAdsSummary, fetchAdAccounts } from "@/lib/ads-queries";
import { Badge } from "@/components/ui/badge";
import { AdsKpiCard } from "@/components/ads/ads-kpi-card";
import { AdsChart } from "@/components/ads/ads-chart";
import { CampaignsTable } from "@/components/ads/campaigns-table";
import { AdsDateFilter } from "@/components/ads/ads-date-filter";

export const metadata: Metadata = {
  title: "Publicités"
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
});

const compactCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("fr-FR");

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

export default async function AdsPage({
  searchParams
}: {
  searchParams?: { tenantId?: string; from?: string; to?: string };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin") {
    if (!searchParams?.tenantId && !profile.tenant_id) {
      redirect("/admin");
    }
  } else {
    await requireClientAccess(profile);
  }

  const isAdmin = profile.role === "agency_admin" && !!searchParams?.tenantId;
  const tenantId = isAdmin ? (searchParams?.tenantId ?? "") : assertTenant(profile);
  if (!tenantId) {
    redirect("/admin");
  }

  // Check demo tenant
  let isDemoTenant = false;
  if (isAdmin) {
    const supabase = createSupabaseServiceClient();
    const { data: tenantInfo } = await supabase
      .from("tenants")
      .select("is_demo")
      .eq("id", tenantId)
      .maybeSingle();
    isDemoTenant = Boolean(tenantInfo?.is_demo);
  }

  // Resolve date range
  const defaults = defaultDateRange();
  const from = searchParams?.from ?? defaults.from;
  const to = searchParams?.to ?? defaults.to;

  // Fetch ad accounts and summary in parallel
  const [adAccounts, adsSummary] = await Promise.all([
    fetchAdAccounts(tenantId, { isAdmin }),
    fetchAdsSummary(tenantId, from, to, { isAdmin })
  ]);

  const hasAdAccounts = adAccounts.length > 0;

  // Format date range for display
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const periodLabel = `du ${fromDate.toLocaleDateString("fr-FR")} au ${toDate.toLocaleDateString("fr-FR")}`;

  if (!hasAdAccounts) {
    return (
      <div className="space-y-8 fade-in">
        {/* Header */}
        <section className="surface-panel p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="section-label">JumpStart Ads</p>
              <h1 className="page-heading">Publicités</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Performances de vos campagnes publicitaires.
              </p>
            </div>
            {isDemoTenant && <Badge variant="outline">MODE DÉMO</Badge>}
          </div>
        </section>

        {/* Empty state */}
        <section className="surface-panel p-12">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
              <svg
                className="h-8 w-8 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Aucun compte publicitaire connecté
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connectez un compte Meta Ads ou LinkedIn Ads pour visualiser les performances de vos campagnes.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Ads</p>
            <h1 className="page-heading">Publicités</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Performances consolidées — <span className="font-medium text-foreground/70">{periodLabel}</span>
              {" · "}{adAccounts.length} compte{adAccounts.length > 1 ? "s" : ""}
            </p>
          </div>
          {isDemoTenant && <Badge variant="outline">MODE DÉMO</Badge>}
        </div>
        <div className="mt-6">
          <AdsDateFilter from={from} to={to} />
        </div>
      </section>

      {/* KPI Row 1: Spend, Impressions, Clicks, CTR */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdsKpiCard
          label="Dépenses"
          value={compactCurrencyFormatter.format(adsSummary.totalSpend)}
          description="Budget total dépensé sur la période."
          index={0}
        />
        <AdsKpiCard
          label="Impressions"
          value={numberFormatter.format(adsSummary.totalImpressions)}
          description="Nombre total d'affichages de vos publicités."
          index={1}
        />
        <AdsKpiCard
          label="Clics"
          value={numberFormatter.format(adsSummary.totalClicks)}
          description="Nombre total de clics sur vos publicités."
          index={2}
        />
        <AdsKpiCard
          label="CTR"
          value={`${adsSummary.avgCtr.toFixed(2)}%`}
          description="Taux de clics moyen (clics / impressions)."
          index={3}
        />
      </section>

      {/* KPI Row 2: CPC, CPM, Conversions, ROAS */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdsKpiCard
          label="CPC"
          value={currencyFormatter.format(adsSummary.avgCpc)}
          description="Coût par clic moyen."
          index={4}
        />
        <AdsKpiCard
          label="CPM"
          value={currencyFormatter.format(adsSummary.avgCpm)}
          description="Coût pour 1 000 impressions."
          index={5}
        />
        <AdsKpiCard
          label="Conversions"
          value={numberFormatter.format(adsSummary.totalConversions)}
          description="Actions de conversion enregistrées."
          index={6}
        />
        <AdsKpiCard
          label="ROAS"
          value={adsSummary.roas !== null ? adsSummary.roas.toFixed(2) : "N/A"}
          description="Retour sur investissement publicitaire (conversions / dépenses)."
          index={7}
        />
      </section>

      {/* Chart */}
      <section>
        <AdsChart
          data={adsSummary.daily.map((d) => ({
            date: d.date,
            spend: d.spend,
            impressions: d.impressions
          }))}
        />
      </section>

      {/* Campaigns table */}
      <section>
        <CampaignsTable
          campaigns={adsSummary.campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            platform: c.platform,
            status: c.status,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks,
            ctr: c.ctr,
            cpc: c.cpc
          }))}
        />
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
