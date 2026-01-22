import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DashboardMetric } from "@/lib/types/dashboard";

type DailyMetricsTableProps = {
  metrics: DashboardMetric[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

export function DailyMetricsTable({ metrics, showViews, showReach, showEngagements }: DailyMetricsTableProps) {
  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Métriques quotidiennes</h2>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Abonnés</TableHead>
                {showViews && <TableHead>Vues</TableHead>}
                {showReach && <TableHead>Portée</TableHead>}
                {showEngagements && <TableHead>Engagements</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((row) => (
                <TableRow key={row.date}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{(row.followers ?? 0).toLocaleString()}</TableCell>
                  {showViews && <TableCell>{(row.views ?? 0).toLocaleString()}</TableCell>}
                  {showReach && <TableCell>{(row.reach ?? 0).toLocaleString()}</TableCell>}
                  {showEngagements && <TableCell>{(row.engagements ?? 0).toLocaleString()}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </section>
  );
}
