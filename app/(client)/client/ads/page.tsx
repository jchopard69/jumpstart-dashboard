import { getSessionProfile, requireClientAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchAdsData } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyAds } from "@/components/ui/empty-state";

const presets = [
  { value: "last_7_days", label: "7 derniers jours" },
  { value: "last_30_days", label: "30 derniers jours" },
  { value: "last_90_days", label: "90 derniers jours" },
  { value: "last_365_days", label: "365 derniers jours" },
  { value: "this_month", label: "Ce mois-ci" },
  { value: "last_month", label: "Mois dernier" }
];

export default async function ClientAdsPage({
  searchParams
}: {
  searchParams: { preset?: string; from?: string; to?: string; platform?: string; tenantId?: string };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin") {
    if (!searchParams.tenantId) {
      redirect("/admin");
    }
  } else {
    requireClientAccess(profile);
  }

  const preset = (searchParams.preset ?? "last_30_days") as any;
  const data = await fetchAdsData({
    preset,
    from: searchParams.from,
    to: searchParams.to,
    platform: (searchParams.platform as any) ?? "all",
    profile,
    tenantId: searchParams.tenantId
  });

  const trendImpressions = data.daily.map((item) => ({ date: item.date, value: item.impressions }));
  const trendSpend = data.daily.map((item) => ({ date: item.date, value: item.spend }));
  const trendClicks = data.daily.map((item) => ({ date: item.date, value: item.clicks }));

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JumpStart Ads</p>
            <h1 className="page-heading">Campagnes publicitaires</h1>
            <p className="mt-2 text-sm text-muted-foreground">Synthèse Meta + LinkedIn Ads.</p>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="/client/ads">
            <select
              name="preset"
              defaultValue={preset}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {presets.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select
              name="platform"
              defaultValue={searchParams.platform ?? "all"}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">Toutes plateformes</option>
              <option value="meta">Meta Ads</option>
              <option value="linkedin">LinkedIn Ads</option>
            </select>
            <input type="hidden" name="from" value={searchParams.from ?? ""} />
            <input type="hidden" name="to" value={searchParams.to ?? ""} />
            <input type="hidden" name="tenantId" value={searchParams.tenantId ?? ""} />
            <Button type="submit">Filtrer</Button>
          </form>
        </div>
      </section>

      {!data.available && (
        <section className="card-surface rounded-3xl p-8">
          <EmptyAds />
        </section>
      )}

      {data.available && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Spend</p>
              <p className="text-2xl font-semibold">{data.totals.spend.toFixed(2)} €</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Impressions</p>
              <p className="text-2xl font-semibold">{data.totals.impressions.toLocaleString()}</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Portée</p>
              <p className="text-2xl font-semibold">{data.totals.reach.toLocaleString()}</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clicks</p>
              <p className="text-2xl font-semibold">{data.totals.clicks.toLocaleString()}</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CTR</p>
              <p className="text-2xl font-semibold">{data.totals.ctr.toFixed(2)}%</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CPC</p>
              <p className="text-2xl font-semibold">{data.totals.cpc.toFixed(2)} €</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CPM</p>
              <p className="text-2xl font-semibold">{data.totals.cpm.toFixed(2)} €</p>
            </Card>
            <Card className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conversions</p>
              <p className="text-2xl font-semibold">{data.totals.conversions.toLocaleString()}</p>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TrendChart title="Impressions" data={trendImpressions} />
            <TrendChart title="Spend" data={trendSpend} />
            <TrendChart title="Clicks" data={trendClicks} />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card-surface rounded-3xl p-6 lg:col-span-2">
              <h2 className="section-title">Top campagnes</h2>
              <div className="mt-4">
                {data.topCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune campagne sur la période.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campagne</TableHead>
                        <TableHead>Plateforme</TableHead>
                        <TableHead>Impressions</TableHead>
                        <TableHead>Clicks</TableHead>
                        <TableHead>Conversions</TableHead>
                        <TableHead>Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topCampaigns.map((campaign) => (
                        <TableRow key={`${campaign.platform}-${campaign.name}`}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell className="text-xs uppercase">{campaign.platform}</TableCell>
                          <TableCell>{campaign.impressions.toLocaleString()}</TableCell>
                          <TableCell>{campaign.clicks.toLocaleString()}</TableCell>
                          <TableCell>{campaign.conversions.toLocaleString()}</TableCell>
                          <TableCell>{campaign.spend.toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            <div className="card-surface rounded-3xl p-6">
              <h2 className="section-title">Performance par plateforme</h2>
              <div className="mt-4 space-y-3">
                {(data.platforms ?? []).map((platform) => (
                  <div key={platform.platform} className="rounded-xl border border-border/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{platform.platform.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{platform.spend.toFixed(2)} €</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Impressions: {platform.impressions.toLocaleString()}</span>
                      <span>Portée: {platform.reach.toLocaleString()}</span>
                      <span>Clicks: {platform.clicks.toLocaleString()}</span>
                      <span>Conversions: {platform.conversions.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {(data.platforms ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
                ) : null}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
