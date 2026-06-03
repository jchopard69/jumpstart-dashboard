import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AdminOpsCockpit } from "@/lib/admin-ops-cockpit";

type AdminOpsCockpitCardProps = {
  cockpit: AdminOpsCockpit;
};

const statusMeta: Record<AdminOpsCockpit["status"], { variant: "success" | "warning" | "danger"; icon: typeof CheckCircle2 }> = {
  healthy: { variant: "success", icon: CheckCircle2 },
  watch: { variant: "warning", icon: Activity },
  risk: { variant: "danger", icon: TriangleAlert },
};

export function AdminOpsCockpitCard({ cockpit }: AdminOpsCockpitCardProps) {
  const meta = statusMeta[cockpit.status];
  const Icon = meta.icon;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_48%,#7c3aed_100%)] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                Agency Ops
              </p>
              <h2 className="mt-2 text-xl font-semibold">Cockpit opérationnel</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/72">
                {cockpit.summary}
              </p>
            </div>
            <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
              Score {cockpit.score}/100
            </Badge>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <Badge variant={meta.variant} className="text-[10px]">
                {cockpit.label}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold">Priorité agence</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {cockpit.nextAction}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs leading-relaxed text-foreground/80">{cockpit.proof}</p>
            <Link
              href={cockpit.priorityHref}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-4"
            >
              Ouvrir le contexte
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
