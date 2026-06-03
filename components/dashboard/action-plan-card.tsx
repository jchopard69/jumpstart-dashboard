import type React from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardActionItem } from "@/lib/dashboard-action-plan";

type ActionPlanCardProps = {
  actions: DashboardActionItem[];
};

const priorityStyles: Record<DashboardActionItem["priority"], { label: string; badge: "danger" | "warning" | "success"; dot: string }> = {
  high: { label: "Prioritaire", badge: "danger", dot: "bg-rose-500" },
  medium: { label: "Important", badge: "warning", dot: "bg-amber-500" },
  low: { label: "Optimisation", badge: "success", dot: "bg-emerald-500" },
};

const horizonIcons: Record<DashboardActionItem["horizon"], React.ReactNode> = {
  "Aujourd'hui": <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
  "Cette semaine": <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />,
  "Ce mois-ci": <Target className="h-3.5 w-3.5" aria-hidden="true" />,
};

export function ActionPlanCard({ actions }: ActionPlanCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="section-title">Plan d'actions</h2>
            <p className="text-xs text-muted-foreground">Priorités recommandées pour la prochaine itération.</p>
          </div>
        </div>
        <Badge variant="secondary">{actions.length} action{actions.length > 1 ? "s" : ""}</Badge>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {actions.map((action, index) => {
          const style = priorityStyles[action.priority];
          return (
            <div key={action.id} className="rounded-xl border border-border/60 bg-white/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-white text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <Badge variant={style.badge} className="text-[10px]">
                  {style.label}
                </Badge>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  {horizonIcons[action.horizon]}
                  <span>{action.horizon}</span>
                </div>
                <h3 className="text-sm font-semibold leading-snug text-foreground">{action.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{action.rationale}</p>
                {action.metric && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-foreground/75">
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    <span>{action.metric}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
