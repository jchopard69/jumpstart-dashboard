"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type CampaignRow = {
  id: string;
  name: string;
  platform: "meta" | "linkedin";
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
};

type SortKey = "name" | "spend" | "impressions" | "clicks" | "ctr" | "cpc";
type SortDirection = "asc" | "desc";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("fr-FR");

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  linkedin: "LinkedIn"
};

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "secondary" }> = {
  active: { label: "Actif", variant: "success" },
  ACTIVE: { label: "Actif", variant: "success" },
  enabled: { label: "Actif", variant: "success" },
  ENABLED: { label: "Actif", variant: "success" },
  paused: { label: "En pause", variant: "warning" },
  PAUSED: { label: "En pause", variant: "warning" },
  completed: { label: "Terminée", variant: "secondary" },
  archived: { label: "Archivée", variant: "secondary" },
  ARCHIVED: { label: "Archivée", variant: "secondary" },
  deleted: { label: "Supprimée", variant: "secondary" },
  DELETED: { label: "Supprimée", variant: "secondary" }
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG[status.toLowerCase()] ?? { label: status, variant: "secondary" as const };
}

type CampaignsTableProps = {
  campaigns: CampaignRow[];
};

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal, "fr")
        : bVal.localeCompare(aVal, "fr");
    }
    const diff = (aVal as number) - (bVal as number);
    return sortDirection === "asc" ? diff : -diff;
  });

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return (
        <svg className="ml-1 inline h-3 w-3 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    return (
      <svg className="ml-1 inline h-3 w-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {sortDirection === "asc" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        )}
      </svg>
    );
  };

  if (campaigns.length === 0) {
    return (
      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title mb-4">Campagnes</h2>
        <div className="py-8 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
            <svg
              className="h-5 w-5 text-muted-foreground/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Aucune campagne sur cette période.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-surface fade-in-up overflow-hidden">
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="section-title">Campagnes</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  Campagne
                  <SortIcon columnKey="name" />
                </button>
              </TableHead>
              <TableHead>Plateforme</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("spend")}
                >
                  Dépenses
                  <SortIcon columnKey="spend" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("impressions")}
                >
                  Impressions
                  <SortIcon columnKey="impressions" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("clicks")}
                >
                  Clics
                  <SortIcon columnKey="clicks" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("ctr")}
                >
                  CTR
                  <SortIcon columnKey="ctr" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort("cpc")}
                >
                  CPC
                  <SortIcon columnKey="cpc" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((campaign) => {
              const statusCfg = getStatusConfig(campaign.status);
              return (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium text-sm max-w-[240px] truncate">
                    {campaign.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {PLATFORM_LABELS[campaign.platform] ?? campaign.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusCfg.variant} className="text-[10px] px-1.5 py-0">
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {currencyFormatter.format(campaign.spend)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {numberFormatter.format(campaign.impressions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {numberFormatter.format(campaign.clicks)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {campaign.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {currencyFormatter.format(campaign.cpc)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
