import { KpiCard } from "./kpi-card";
import { computeEngagementRate } from "@/lib/metrics";
import type { DashboardTotals, DashboardDelta } from "@/lib/types/dashboard";
import type { TenantGoals } from "@/lib/goals";

type KpiSectionProps = {
  totals: DashboardTotals | null;
  delta: DashboardDelta;
  goals?: TenantGoals | null;
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

export function KpiSection({ totals, delta, goals, showViews, showReach, showEngagements }: KpiSectionProps) {
  const rawRate = computeEngagementRate(
    totals?.engagements ?? 0,
    totals?.views ?? 0,
    totals?.reach ?? 0
  );
  // Format: 1 decimal, show "< 0.1" for very small non-zero rates
  const engagementRate = rawRate !== null
    ? (rawRate > 0 && rawRate < 0.1 ? 0.1 : Number(rawRate.toFixed(1)))
    : null;

  const cards = [
    { label: "Abonnés", value: totals?.followers ?? 0, delta: delta.followers, goal: goals?.followers_target },
    showViews ? { label: "Vues", value: totals?.views ?? 0, delta: delta.views, goal: goals?.views_target } : null,
    showReach ? { label: "Portée", value: totals?.reach ?? 0, delta: delta.reach, goal: goals?.reach_target } : null,
    showEngagements ? { label: "Engagements", value: totals?.engagements ?? 0, delta: delta.engagements } : null,
    { label: "Publications", value: totals?.posts_count ?? 0, delta: delta.posts_count },
    { label: "Taux d'engagement", value: engagementRate, delta: 0, suffix: "%", goal: goals?.engagement_rate_target },
  ].filter(Boolean) as Array<{ label: string; value: number | null; delta: number; suffix?: string; goal?: number | null }>;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card, i) => (
        <KpiCard key={card.label} index={i} {...card} />
      ))}
    </section>
  );
}
