import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardMetric, SyncStatus as SyncStatusType } from "@/lib/types/dashboard";

type SyncStatusProps = {
  lastSync: SyncStatusType | null;
  range?: { start: Date; end: Date };
  metrics?: DashboardMetric[];
};

export function SyncStatus({ lastSync, range, metrics = [] }: SyncStatusProps) {
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Synchronisé</Badge>;
      case "failed":
        return <Badge variant="danger">Échec</Badge>;
      case "running":
        return <Badge variant="warning">En cours</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const getRelativeTime = (date: string | null) => {
    if (!date) return "jamais";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "à l'instant";
    if (diffMins < 60) return `il y a ${diffMins} min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays === 1) return "hier";
    return `il y a ${diffDays} jours`;
  };

  const coverage = (() => {
    if (!range) return null;
    const totalDays = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const uniqueDays = new Set(metrics.map((row) => row.date)).size;
    const percent = Math.round((uniqueDays / totalDays) * 100);
    return { totalDays, uniqueDays, percent };
  })();

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Flux de donnees</h2>
            <p className="text-sm text-muted-foreground">Etat de la synchronisation automatique.</p>
          </div>
          {getStatusBadge(lastSync?.status ?? null)}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière synchro {getRelativeTime(lastSync?.finished_at ?? null)}
        </p>
        {coverage && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Couverture données: {coverage.percent}%</span>
            <span>Jours couverts: {coverage.uniqueDays}/{coverage.totalDays}</span>
          </div>
        )}
      </Card>
    </section>
  );
}
