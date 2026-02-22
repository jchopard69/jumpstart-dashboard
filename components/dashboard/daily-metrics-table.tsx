import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DashboardMetric } from "@/lib/types/dashboard";

type DailyMetricsTableProps = {
  metrics: DashboardMetric[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function DailyMetricsTable({ metrics, showViews, showReach, showEngagements }: DailyMetricsTableProps) {
  // Sort by date descending (most recent first)
  const sortedMetrics = [...metrics].sort((a, b) => b.date.localeCompare(a.date));

  if (sortedMetrics.length === 0) {
    return (
      <section>
        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Suivi journalier</h2>
          <div className="mt-4 text-center py-8 text-muted-foreground">
            <p>Aucune donnée disponible pour cette période.</p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Suivi journalier</h2>
          <span className="text-xs text-muted-foreground">{sortedMetrics.length} jours</span>
        </div>
        <div className="mt-4 max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead className="text-right">Abonnés</TableHead>
                {showViews && <TableHead className="text-right">Vues</TableHead>}
                {showReach && <TableHead className="text-right">Portée</TableHead>}
                {showEngagements && <TableHead className="text-right">Engagements</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMetrics.map((row, idx) => (
                <TableRow key={row.date} className={idx === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.followers ?? 0)}</TableCell>
                  {showViews && <TableCell className="text-right tabular-nums">{formatNumber(row.views ?? 0)}</TableCell>}
                  {showReach && <TableCell className="text-right tabular-nums">{formatNumber(row.reach ?? 0)}</TableCell>}
                  {showEngagements && <TableCell className="text-right tabular-nums">{formatNumber(row.engagements ?? 0)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </section>
  );
}
