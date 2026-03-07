import { KpiCard } from "./kpi-card";
import { computeEngagementRate } from "@/lib/metrics";
import type { DashboardTotals, DashboardDelta, DashboardMetric } from "@/lib/types/dashboard";
import type { TenantGoals } from "@/lib/goals";

type KpiSectionProps = {
  totals: DashboardTotals | null;
  delta: DashboardDelta;
  goals?: TenantGoals | null;
  metrics?: DashboardMetric[];
  comparisonLabel?: string;
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

function buildSparkline(metrics: DashboardMetric[], key: keyof DashboardMetric): number[] {
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map(m => (m[key] as number | null) ?? 0);
}

export function KpiSection({ totals, delta, goals, metrics = [], comparisonLabel, showViews, showReach, showEngagements }: KpiSectionProps) {
  const rawRate = totals
    ? computeEngagementRate(
        totals.engagements ?? 0,
        totals.views ?? 0,
        totals.reach ?? 0
      )
    : null;
  // Format: 1 decimal, show "< 0.1" for very small non-zero rates
  // Keep null when there's no data so KpiCard shows "N/A" instead of "0%"
  const engagementRate = rawRate !== null && rawRate !== undefined
    ? (rawRate > 0 && rawRate < 0.1 ? 0.1 : Number(rawRate.toFixed(1)))
    : null;

  const hasSparklineData = metrics.length >= 3;

  const cards = [
    { label: "Abonnés", value: totals?.followers ?? 0, delta: delta.followers, goal: goals?.followers_target, sparkline: hasSparklineData ? buildSparkline(metrics, "followers") : undefined },
    showViews ? { label: "Vues", value: totals?.views ?? 0, delta: delta.views, goal: goals?.views_target, sparkline: hasSparklineData ? buildSparkline(metrics, "views") : undefined } : null,
    showReach ? { label: "Portée", value: totals?.reach ?? 0, delta: delta.reach, goal: goals?.reach_target, sparkline: hasSparklineData ? buildSparkline(metrics, "reach") : undefined } : null,
    showEngagements ? { label: "Engagements", value: totals?.engagements ?? 0, delta: delta.engagements, sparkline: hasSparklineData ? buildSparkline(metrics, "engagements") : undefined } : null,
    { label: "Publications", value: totals?.posts_count ?? 0, delta: delta.posts_count },
    { label: "Taux d'engagement", value: engagementRate, delta: 0, suffix: "%", goal: goals?.engagement_rate_target },
  ].filter(Boolean) as Array<{ label: string; value: number | null; delta: number; suffix?: string; goal?: number | null; sparkline?: number[] }>;

  return (
    <section>
      {comparisonLabel && (
        <p className="text-[11px] text-muted-foreground mb-3">
          Variations vs {comparisonLabel}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card, i) => (
          <KpiCard key={card.label} index={i} {...card} />
        ))}
      </div>
    </section>
  );
}
