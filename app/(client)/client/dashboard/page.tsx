import { getSessionProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";

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

  const queryString = new URLSearchParams({
    preset: preset,
    from: searchParams.from ?? "",
    to: searchParams.to ?? "",
    platform: searchParams.platform ?? "",
    tenantId: searchParams.tenantId ?? "",
    accountId: searchParams.accountId ?? ""
  }).toString();

  const trendFollowers = data.metrics.map((item) => ({ date: item.date, value: item.followers ?? 0 }));
  const trendViews = data.metrics.map((item) => ({ date: item.date, value: item.views ?? 0 }));
  const trendEngagements = data.metrics.map((item) => ({ date: item.date, value: item.engagements ?? 0 }));
  const trendReach = data.metrics.map((item) => ({ date: item.date, value: item.reach ?? 0 }));

  const showViews = data.perPlatform.some((item) => item.available.views);
  const showReach = data.perPlatform.some((item) => item.available.reach);
  const showEngagements = data.perPlatform.some((item) => item.available.engagements);

  const engagementRate = data.totals?.views
    ? Number(((data.totals.engagements ?? 0) / data.totals.views * 100).toFixed(1))
    : 0;

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
            <ExportButtons query={queryString} />
          </div>
        </div>
        <div className="mt-6">
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Abonnés" value={data.totals?.followers ?? 0} delta={data.delta.followers} />
        {showViews ? <KpiCard label="Vues" value={data.totals?.views ?? 0} delta={data.delta.views} /> : null}
        {showReach ? <KpiCard label="Portée" value={data.totals?.reach ?? 0} delta={data.delta.reach} /> : null}
        {showEngagements ? <KpiCard label="Engagements" value={data.totals?.engagements ?? 0} delta={data.delta.engagements} /> : null}
        <KpiCard label="Publications" value={data.totals?.posts_count ?? 0} delta={data.delta.posts_count} />
        <KpiCard
          label="Taux d'engagement"
          value={engagementRate}
          delta={0}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart title="Abonnés" data={trendFollowers} />
        {showViews ? <TrendChart title="Vues" data={trendViews} /> : null}
        {showEngagements ? <TrendChart title="Engagements" data={trendEngagements} /> : null}
        {showReach ? <TrendChart title="Portée" data={trendReach} /> : null}
      </section>

      <section>
        <Card className="card-surface p-6 fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Détail par plateforme</h2>
              <p className="text-sm text-muted-foreground">Résumé des performances par réseau connecté.</p>
            </div>
          </div>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plateforme</TableHead>
                  <TableHead>Abonnés</TableHead>
                  <TableHead>Publications</TableHead>
                  {showEngagements ? <TableHead>Engagements</TableHead> : null}
                  <TableHead>Taux d&apos;engagement</TableHead>
                  {showReach ? <TableHead>Portée</TableHead> : null}
                  {showViews ? <TableHead>Vues</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perPlatform.map((item) => {
                  const rate = item.totals.views
                    ? Number(((item.totals.engagements / item.totals.views) * 100).toFixed(1))
                    : 0;
                  return (
                    <TableRow key={item.platform}>
                      <TableCell className="font-medium">
                        {PLATFORM_LABELS[item.platform as Platform]}
                      </TableCell>
                      <TableCell>{item.totals.followers.toLocaleString()}</TableCell>
                      <TableCell>{item.totals.posts_count.toLocaleString()}</TableCell>
                      {showEngagements ? <TableCell>{item.totals.engagements.toLocaleString()}</TableCell> : null}
                      <TableCell>{rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</TableCell>
                      {showReach ? <TableCell>{item.totals.reach.toLocaleString()}</TableCell> : null}
                      {showViews ? <TableCell>{item.totals.views.toLocaleString()}</TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-surface p-6 lg:col-span-2 fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Top contenus</h2>
              <p className="text-sm text-muted-foreground">Publications les plus performantes sur la période.</p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {data.posts.map((post) => (
              <div key={post.id} className="flex items-start gap-4 border-b border-border pb-4 last:border-0">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.thumbnail_url} alt="thumbnail" className="h-20 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{post.caption ?? "Publication sans titre"}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Impressions: {post.metrics?.impressions ?? post.metrics?.views ?? 0}</p>
                  <p>Engagements: {post.metrics?.engagements ?? post.metrics?.likes ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Collaboration</h2>
          <p className="text-sm text-muted-foreground">Suivi de production & prochains shootings.</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">Jours de shooting restants</p>
              <Badge variant="secondary">{data.collaboration?.shoot_days_remaining ?? 0}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Shootings à venir</p>
              <div className="mt-2 space-y-2">
                {data.shoots.map((shoot) => (
                  <div key={shoot.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{new Date(shoot.shoot_date).toLocaleDateString("fr-FR")}</p>
                    <p className="text-xs text-muted-foreground">{shoot.location}</p>
                    {shoot.notes ? <p className="text-xs text-muted-foreground">{shoot.notes}</p> : null}
                  </div>
                ))}
                {!data.shoots.length ? <p className="text-xs text-muted-foreground">Aucun shooting planifié.</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Documents partagés</p>
              <ul className="mt-2 space-y-2">
                {data.documents.slice(0, 4).map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-sm">
                    <span>{doc.file_name}</span>
                    <Badge variant="outline">{doc.tag}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card className="card-surface p-6 fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Statut de synchronisation</h2>
              <p className="text-sm text-muted-foreground">Dernière mise à jour automatique.</p>
            </div>
            <Badge variant={data.lastSync?.status === "success" ? "success" : "warning"}>
              {data.lastSync?.status ?? "idle"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Dernière synchro {data.lastSync?.finished_at ? new Date(data.lastSync.finished_at).toLocaleString("fr-FR") : "jamais"}
          </p>
        </Card>
      </section>

      <section>
        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Métriques quotidiennes</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Abonnés</TableHead>
                {showViews ? <TableHead>Vues</TableHead> : null}
                {showReach ? <TableHead>Portée</TableHead> : null}
                {showEngagements ? <TableHead>Engagements</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.metrics.map((row) => (
                <TableRow key={row.date}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.followers ?? 0}</TableCell>
                  {showViews ? <TableCell>{row.views ?? 0}</TableCell> : null}
                  {showReach ? <TableCell>{row.reach ?? 0}</TableCell> : null}
                  {showEngagements ? <TableCell>{row.engagements ?? 0}</TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
