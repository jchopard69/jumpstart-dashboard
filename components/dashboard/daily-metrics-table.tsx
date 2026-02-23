"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString("fr-FR");
}

const PAGE_SIZE = 14;

export function DailyMetricsTable({ metrics, showViews, showReach, showEngagements }: DailyMetricsTableProps) {
  const [expanded, setExpanded] = useState(false);
  // Sort by date descending (most recent first)
  const sortedMetrics = [...metrics].sort((a, b) => b.date.localeCompare(a.date));

  if (sortedMetrics.length === 0) {
    return (
      <section>
        <Card className="card-surface p-6 fade-in-up">
          <h2 className="section-title">Suivi journalier</h2>
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                <svg className="h-5 w-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Aucune donnée disponible pour cette période.</p>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  const displayMetrics = expanded ? sortedMetrics : sortedMetrics.slice(0, PAGE_SIZE);
  const hasMore = sortedMetrics.length > PAGE_SIZE;

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Suivi journalier</h2>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {sortedMetrics.length} jour{sortedMetrics.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px] text-[11px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Abonnés</TableHead>
                {showViews && <TableHead className="text-right text-[11px] uppercase tracking-wider">Vues</TableHead>}
                {showReach && <TableHead className="text-right text-[11px] uppercase tracking-wider">Portée</TableHead>}
                {showEngagements && <TableHead className="text-right text-[11px] uppercase tracking-wider">Engagements</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMetrics.map((row, idx) => (
                <TableRow key={row.date} className={idx === 0 ? "bg-primary/[0.03]" : ""}>
                  <TableCell className="font-medium text-sm">{formatDate(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatNumber(row.followers ?? 0)}</TableCell>
                  {showViews && <TableCell className="text-right tabular-nums text-sm">{formatNumber(row.views ?? 0)}</TableCell>}
                  {showReach && <TableCell className="text-right tabular-nums text-sm">{formatNumber(row.reach ?? 0)}</TableCell>}
                  {showEngagements && <TableCell className="text-right tabular-nums text-sm">{formatNumber(row.engagements ?? 0)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Réduire" : `Voir les ${sortedMetrics.length - PAGE_SIZE} jours restants`}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}
