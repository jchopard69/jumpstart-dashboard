import { Activity, ArrowRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AdminClientReadiness } from "@/lib/admin-client-readiness";

type AdminClientReadinessCardProps = {
  readiness: AdminClientReadiness;
};

const statusMeta: Record<AdminClientReadiness["status"], { variant: "success" | "warning" | "danger"; icon: typeof CheckCircle2 }> = {
  ready: { variant: "success", icon: CheckCircle2 },
  watch: { variant: "warning", icon: Activity },
  risk: { variant: "danger", icon: TriangleAlert },
};

export function AdminClientReadinessCard({ readiness }: AdminClientReadinessCardProps) {
  const meta = statusMeta[readiness.status];
  const Icon = meta.icon;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_48%,#14b8a6_100%)] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                Client Readiness
              </p>
              <h2 className="mt-2 text-xl font-semibold">Priorité opérationnelle</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/72">
                {readiness.summary}
              </p>
            </div>
            <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
              Score {readiness.score}/100
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Risques</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{readiness.risks.length}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Points solides</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{readiness.strengths.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <Badge variant={meta.variant} className="text-[10px]">
                {readiness.label}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold">Action agence</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {readiness.nextAction}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs leading-relaxed text-foreground/80">{readiness.proof}</p>
            {readiness.risks.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                +{readiness.risks.length - 1} autre{readiness.risks.length > 2 ? "s" : ""} point{readiness.risks.length > 2 ? "s" : ""} à traiter.
              </p>
            )}
            <a
              href={readiness.priorityAnchor}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-4"
            >
              Ouvrir la section
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
