import { buildDailySeries } from "@/lib/daily-series";
import { KpiCard } from "./kpi-card";
import { computeEngagementRate } from "@/lib/metrics";
import type { DashboardTotals, DashboardDelta, DashboardMetric } from "@/lib/types/dashboard";
import type { TenantGoals } from "@/lib/goals";

type KpiSectionProps = {
  totals: DashboardTotals | null;
  delta: DashboardDelta;
  previousTotals?: DashboardTotals;
  goals?: TenantGoals | null;
  metrics?: DashboardMetric[];
  comparisonLabel?: string;
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

export function KpiSection({ totals, delta, previousTotals, goals, metrics = [], comparisonLabel, showViews, showReach, showEngagements }: KpiSectionProps) {
  const rawRate = totals
    ? computeEngagementRate(
        totals.engagements ?? 0,
        totals.views ?? 0,
        totals.reach ?? 0
      )
    : null;
  const engagementRate = rawRate;
  const comparison = (key: keyof DashboardTotals) => previousTotals && previousTotals[key] <= 0 ? null : delta[key];

  const hasSparklineData = metrics.length >= 3;

  const cards = [
    { label: "Abonnés", value: totals?.followers ?? 0, delta: comparison("followers"), goal: goals?.followers_target, sparkline: hasSparklineData ? buildDailySeries(metrics, "followers") : undefined },
    showViews ? { label: "Vues", value: totals?.views ?? 0, delta: comparison("views"), goal: goals?.views_target, sparkline: hasSparklineData ? buildDailySeries(metrics, "views") : undefined } : null,
    showReach ? { label: "Portée", value: totals?.reach ?? 0, delta: comparison("reach"), goal: goals?.reach_target, sparkline: hasSparklineData ? buildDailySeries(metrics, "reach") : undefined } : null,
    showEngagements ? { label: "Engagements", value: totals?.engagements ?? 0, delta: comparison("engagements"), sparkline: hasSparklineData ? buildDailySeries(metrics, "engagements") : undefined } : null,
    { label: "Publications", value: totals?.posts_count ?? 0, delta: comparison("posts_count") },
    { label: "Taux d'engagement", value: engagementRate, delta: 0, suffix: "%", goal: goals?.engagement_rate_target },
  ].filter(Boolean) as Array<{ label: string; value: number | null; delta: number | null; suffix?: string; goal?: number | null; sparkline?: number[] }>;

  return (
    <section>
      {comparisonLabel && (
        <p className="text-[11px] text-muted-foreground mb-3">
          Variations vs {comparisonLabel}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.filter(card => card.label !== "Portée" && !card.suffix).map((card, i) => (
          <KpiCard key={card.label} index={i} {...card} />
        ))}
      </div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted-foreground focus-visible:outline focus-visible:outline-2">Portée cumulée et ratio d’interactions</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{cards.filter(card => card.label === "Portée" || card.suffix).map(card => <KpiCard key={card.label} {...card} />)}</div><p className="mt-3 text-xs text-muted-foreground">Le ratio utilise les vues disponibles, sinon la portée cumulée. Ce taux agrégé dépend du mix de réseaux ; il ne constitue pas un benchmark.</p>
        {metrics.some(row => row.platform === "tiktok") && <p className="mt-2 text-xs text-muted-foreground">TikTok est exclu de la portée : seules les vues sont disponibles. Ses résultats correspondent aux cumuls des vidéos publiées dans la période, et non aux vues consommées pendant le mois.</p>}
      </details>
    </section>
  );
}
