import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATFORM_LABELS, PLATFORM_ICONS, type Platform } from "@/lib/types";
import type { PlatformData } from "@/lib/types/dashboard";

type PlatformTableProps = {
  perPlatform: PlatformData[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function PlatformTable({ perPlatform, showViews, showReach, showEngagements }: PlatformTableProps) {
  if (perPlatform.length === 0) {
    return (
      <section>
        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Ecosysteme digital</h2>
          <div className="mt-4 text-center py-8 text-muted-foreground">
            <p>Aucune plateforme connectée.</p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Ecosysteme digital</h2>
            <p className="text-sm text-muted-foreground">Performance detaillee par canal.</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plateforme</TableHead>
                <TableHead className="text-right">Abonnés</TableHead>
                <TableHead className="text-right">Publications</TableHead>
                {showEngagements && <TableHead className="text-right">Engagements</TableHead>}
                <TableHead className="text-right">Taux d&apos;eng.</TableHead>
                {showReach && <TableHead className="text-right">Portée</TableHead>}
                {showViews && <TableHead className="text-right">Vues</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perPlatform.map((item) => {
                const rate = item.totals.views
                  ? Number(((item.totals.engagements / item.totals.views) * 100).toFixed(1))
                  : 0;
                const platform = item.platform as Platform;
                return (
                  <TableRow key={item.platform}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-lg">{PLATFORM_ICONS[platform]}</span>
                        {PLATFORM_LABELS[platform]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.totals.followers)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.totals.posts_count)}</TableCell>
                    {showEngagements && <TableCell className="text-right tabular-nums">{formatNumber(item.totals.engagements)}</TableCell>}
                    <TableCell className="text-right tabular-nums">
                      {rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </TableCell>
                    {showReach && <TableCell className="text-right tabular-nums">{formatNumber(item.totals.reach)}</TableCell>}
                    {showViews && <TableCell className="text-right tabular-nums">{formatNumber(item.totals.views)}</TableCell>}
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
