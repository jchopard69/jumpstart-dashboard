import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { DashboardDataQuality, PlatformDataQuality } from "@/lib/dashboard-data-quality";
import { cn } from "@/lib/utils";

type DataQualityCardProps = {
  quality: DashboardDataQuality;
};

const statusLabels: Record<PlatformDataQuality["status"], string> = {
  good: "Complet",
  partial: "Partiel",
  missing: "À vérifier",
};

const statusStyles: Record<PlatformDataQuality["status"], string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-rose-50 text-rose-700 border-rose-200",
};

const metricLabels: Record<PlatformDataQuality["missingMetrics"][number], string> = {
  views: "vues",
  reach: "portée",
  engagements: "engagements",
};

function getCoverageLabel(value: number): string {
  if (value >= 80) return "Fiabilité élevée";
  if (value >= 50) return "Fiabilité moyenne";
  return "Fiabilité limitée";
}

function PlatformCoverageRow({ item }: { item: PlatformDataQuality }) {
  const platform = item.platform as Platform;
  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">{PLATFORM_ICONS[platform]}</span>
          <span className="truncate text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusStyles[item.status])}>
          {statusLabels[item.status]}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            item.status === "good" ? "bg-emerald-500" : item.status === "partial" ? "bg-amber-500" : "bg-rose-500"
          )}
          style={{ width: `${Math.min(100, item.coverage)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{item.coveredDays}/{item.expectedDays} jours</span>
        <span className="text-center">
          {item.accounts} compte{item.accounts > 1 ? "s" : ""}
        </span>
        <span className="text-right tabular-nums">{item.coverage}%</span>
      </div>
      {item.missingMetrics.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Données à contrôler: {item.missingMetrics.map((metric) => metricLabels[metric]).join(", ")}
        </p>
      )}
    </div>
  );
}

export function DataQualityCard({ quality }: DataQualityCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Qualité des données</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Fiabilité de l'analyse sur la période sélectionnée.</p>
        </div>
        <Badge variant={quality.overallCoverage >= 80 ? "success" : quality.overallCoverage >= 50 ? "warning" : "danger"}>
          {getCoverageLabel(quality.overallCoverage)}
        </Badge>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tabular-nums">{quality.overallCoverage}%</p>
            <p className="text-xs text-muted-foreground">couverture moyenne</p>
          </div>
          {quality.staleSync && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
              Synchro à relancer
            </span>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/30">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              quality.overallCoverage >= 80 ? "bg-emerald-500" : quality.overallCoverage >= 50 ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${Math.min(100, quality.overallCoverage)}%` }}
          />
        </div>
      </div>

      {quality.platformQuality.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quality.platformQuality.map((item) => (
            <PlatformCoverageRow key={item.platform} item={item} />
          ))}
        </div>
      )}

      {quality.actions.length > 0 && (
        <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground">Actions recommandées</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {quality.actions.map((action) => (
              <li key={action} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
