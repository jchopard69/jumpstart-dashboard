import { CalendarClock, CheckCircle2, MailCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ReportingHealth } from "@/lib/reporting-health";

type ReportingHealthCardProps = {
  health: ReportingHealth;
};

const statusCopy: Record<ReportingHealth["status"], { variant: "success" | "warning" | "danger"; icon: typeof CheckCircle2 }> = {
  healthy: { variant: "success", icon: CheckCircle2 },
  watch: { variant: "warning", icon: CalendarClock },
  risk: { variant: "danger", icon: TriangleAlert },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Non planifié";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportingHealthCard({ health }: ReportingHealthCardProps) {
  const status = statusCopy[health.status];
  const Icon = status.icon;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="bg-[linear-gradient(135deg,#111827_0%,#2563eb_50%,#0d9488_100%)] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                Reporting OS
              </p>
              <h2 className="mt-2 text-xl font-semibold">Santé du rituel client</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/72">
                {health.summary}
              </p>
            </div>
            <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
              Score {health.score}/100
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Actifs</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{health.activeCount}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Destinataires</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{health.recipientCount}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Statut</p>
              <p className="mt-1 text-sm font-semibold">{health.label}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <Badge variant={status.variant} className="text-[10px]">
                {health.label}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold">Prochaine action</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {health.nextAction}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-2">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-foreground/80">{health.proof}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Prochain : {formatDate(health.nextSendAt)}</span>
              <span>Dernier : {formatDate(health.lastSentAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
