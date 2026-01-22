import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { PlatformData } from "@/lib/types/dashboard";

type PlatformTableProps = {
  perPlatform: PlatformData[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

export function PlatformTable({ perPlatform, showViews, showReach, showEngagements }: PlatformTableProps) {
  return (
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
                {showEngagements && <TableHead>Engagements</TableHead>}
                <TableHead>Taux d&apos;engagement</TableHead>
                {showReach && <TableHead>Portée</TableHead>}
                {showViews && <TableHead>Vues</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perPlatform.map((item) => {
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
                    {showEngagements && <TableCell>{item.totals.engagements.toLocaleString()}</TableCell>}
                    <TableCell>
                      {rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </TableCell>
                    {showReach && <TableCell>{item.totals.reach.toLocaleString()}</TableCell>}
                    {showViews && <TableCell>{item.totals.views.toLocaleString()}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </section>
  );
}
