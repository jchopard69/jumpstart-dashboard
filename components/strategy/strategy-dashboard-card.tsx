import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClientStrategySnapshot } from "@/lib/client-strategy";
import { ArrowRight, Sparkles } from "lucide-react";

export function StrategyDashboardCard({
  snapshot,
  tenantId,
}: {
  snapshot: ClientStrategySnapshot;
  tenantId?: string;
}) {
  const activeActions = snapshot.actionItems.filter((item) => item.status !== "done");
  const nextAction =
    activeActions.find((item) => item.priority === "critical" || item.priority === "high") ??
    activeActions[0] ??
    null;
  const href = tenantId ? `/client/strategy?tenantId=${encodeURIComponent(tenantId)}` : "/client/strategy";

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="section-label">Stratégie JumpStart</p>
              <h2 className="section-title mt-0.5">Direction du moment</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {snapshot.profile?.monthly_focus ||
              snapshot.latestBrief?.next_focus ||
              "Le focus stratégique du mois sera publié ici par l'équipe JumpStart."}
          </p>
          {nextAction && (
            <p className="mt-3 rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-sm text-foreground/80">
              <span className="font-medium">Prochaine action :</span> {nextAction.title}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge variant="secondary">
            {activeActions.length} action{activeActions.length > 1 ? "s" : ""} active{activeActions.length > 1 ? "s" : ""}
          </Badge>
          <a href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4">
            Voir l'espace stratégique
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Card>
  );
}
