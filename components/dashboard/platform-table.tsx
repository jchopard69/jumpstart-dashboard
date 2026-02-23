import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, PLATFORM_ICONS, type Platform } from "@/lib/types";
import type { PlatformData } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

type PlatformTableProps = {
  perPlatform: PlatformData[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
};

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString("fr-FR");
}

function DeltaBadge({ value }: { value: number }) {
  if (!value || Math.abs(value) < 0.1) return null;
  const isUp = value > 0;
  return (
    <span className={cn(
      "ml-1.5 inline-flex items-center text-[10px] font-medium tabular-nums",
      isUp ? "text-emerald-600" : "text-rose-500"
    )}>
      {isUp ? "+" : ""}{Math.round(value)}%
    </span>
  );
}

export function PlatformTable({ perPlatform, showViews, showReach, showEngagements }: PlatformTableProps) {
  if (perPlatform.length === 0) {
    return (
      <section>
        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Ecosysteme digital</h2>
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                <svg className="h-5 w-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Aucune plateforme connectée.</p>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">Ecosysteme digital</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Performance detaillee par canal.</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {perPlatform.length} plateforme{perPlatform.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-wider">Plateforme</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Abonnés</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Publications</TableHead>
                {showEngagements && <TableHead className="text-right text-[11px] uppercase tracking-wider">Engagements</TableHead>}
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Taux eng.</TableHead>
                {showReach && <TableHead className="text-right text-[11px] uppercase tracking-wider">Portée</TableHead>}
                {showViews && <TableHead className="text-right text-[11px] uppercase tracking-wider">Vues</TableHead>}
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
                        <span>{PLATFORM_LABELS[platform]}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(item.totals.followers)}
                      <DeltaBadge value={item.delta?.followers ?? 0} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.totals.posts_count)}</TableCell>
                    {showEngagements && (
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.totals.engagements)}
                        <DeltaBadge value={item.delta?.engagements ?? 0} />
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums font-medium">
                      {rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </TableCell>
                    {showReach && (
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.totals.reach)}
                        <DeltaBadge value={item.delta?.reach ?? 0} />
                      </TableCell>
                    )}
                    {showViews && (
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.totals.views)}
                        <DeltaBadge value={item.delta?.views ?? 0} />
                      </TableCell>
                    )}
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
