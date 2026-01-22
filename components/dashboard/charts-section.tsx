import { TrendChart } from "./trend-chart";
import type { TrendPoint } from "@/lib/types/dashboard";

type ChartsSectionProps = {
  trendFollowers: TrendPoint[];
  trendViews: TrendPoint[];
  trendEngagements: TrendPoint[];
  trendReach: TrendPoint[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
  showComparison?: boolean;
};

export function ChartsSection({
  trendFollowers,
  trendViews,
  trendEngagements,
  trendReach,
  showViews,
  showReach,
  showEngagements,
  showComparison = false
}: ChartsSectionProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TrendChart title="Abonnés" data={trendFollowers} showComparison={showComparison} />
      {showViews && <TrendChart title="Vues" data={trendViews} showComparison={showComparison} />}
      {showEngagements && <TrendChart title="Engagements" data={trendEngagements} showComparison={showComparison} />}
      {showReach && <TrendChart title="Portée" data={trendReach} showComparison={showComparison} />}
    </section>
  );
}
