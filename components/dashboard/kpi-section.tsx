import { KpiCard } from "./kpi-card";
import type { DashboardTotals, DashboardDelta } from "@/lib/types/dashboard";

type KpiSectionProps = {
  totals: DashboardTotals | null;
  delta: DashboardDelta;
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

export function KpiSection({ totals, delta, showViews, showReach, showEngagements }: KpiSectionProps) {
  const engagementRate = totals?.views
    ? Number(((totals.engagements ?? 0) / totals.views * 100).toFixed(1))
    : 0;

  const cards = [
    { label: "Abonnés", value: totals?.followers ?? 0, delta: delta.followers },
    showViews ? { label: "Vues", value: totals?.views ?? 0, delta: delta.views } : null,
    showReach ? { label: "Portée", value: totals?.reach ?? 0, delta: delta.reach } : null,
    showEngagements ? { label: "Engagements", value: totals?.engagements ?? 0, delta: delta.engagements } : null,
    { label: "Publications", value: totals?.posts_count ?? 0, delta: delta.posts_count },
    { label: "Taux d'engagement", value: engagementRate, delta: 0, suffix: "%" },
  ].filter(Boolean) as Array<{ label: string; value: number; delta: number; suffix?: string }>;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card, i) => (
        <KpiCard key={card.label} index={i} {...card} />
      ))}
    </section>
  );
}
