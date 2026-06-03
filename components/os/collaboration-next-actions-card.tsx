import { ArrowRight, CheckCircle2, ClipboardList, FileText, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CollaborationNextAction } from "@/lib/collaboration-actions";

type CollaborationNextActionsCardProps = {
  actions: CollaborationNextAction[];
};

const priorityVariant: Record<CollaborationNextAction["priority"], "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

function getActionIcon(action: CollaborationNextAction) {
  if (action.href.includes("documents")) return FileText;
  if (action.href.includes("notes")) return ClipboardList;
  if (action.id.includes("healthy")) return CheckCircle2;
  return Video;
}

export function CollaborationNextActionsCard({ actions }: CollaborationNextActionsCardProps) {
  if (!actions.length) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,#0f172a_0%,#4f46e5_55%,#14b8a6_100%)] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
              JumpStart Operations
            </p>
            <h2 className="mt-2 text-lg font-semibold">Priorités collaboration</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/72">
              Synthèse automatique du planning, des livrables et des points de suivi à traiter.
            </p>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
            {actions.length} action{actions.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {actions.map((action, index) => {
          const Icon = getActionIcon(action);

          return (
            <article key={action.id} className="flex min-h-[210px] flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-white text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <Badge variant={priorityVariant[action.priority]} className="text-[10px]">
                  {action.label}
                </Badge>
              </div>

              <div className="mt-4 flex-1 space-y-3">
                <h3 className="text-sm font-semibold leading-snug text-foreground">{action.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
                <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                  <p className="text-xs leading-relaxed text-foreground/80">{action.proof}</p>
                </div>
              </div>

              <a href={action.href} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-4">
                Ouvrir le point
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
