import { ArrowRight, ClipboardCheck, Lightbulb, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClientNextAction } from "@/lib/client-next-actions";

type ClientNextActionsCardProps = {
  actions: ClientNextAction[];
};

const priorityBadge: Record<ClientNextAction["priority"], "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

export function ClientNextActionsCard({ actions }: ClientNextActionsCardProps) {
  if (!actions.length) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-gradient-to-r from-slate-950 via-slate-900 to-primary p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10">
              <ClipboardCheck className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Prochaines décisions client</h2>
              <p className="text-xs text-white/70">
                Synthèse automatique des actions à traiter en priorité.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
            {actions.length} priorité{actions.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {actions.map((action, index) => (
          <article key={action.id} className="flex min-h-[230px] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-white text-xs font-semibold text-foreground">
                  {index + 1}
                </span>
                <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <Badge variant={priorityBadge[action.priority]} className="text-[10px]">
                {action.label}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{action.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
              <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                <div className="flex items-start gap-2">
                  <TimerReset className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-foreground/80">{action.proof}</p>
                </div>
              </div>
            </div>

            <a href={action.href} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-4">
              Ouvrir le contexte
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </Card>
  );
}
