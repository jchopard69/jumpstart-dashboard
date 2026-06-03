import { ArrowUpRight, Bot, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DashboardOpportunity } from "@/lib/dashboard-opportunities";

type OpportunityCardProps = {
  opportunities: DashboardOpportunity[];
};

export function OpportunityCard({ opportunities }: OpportunityCardProps) {
  if (!opportunities.length) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-white to-emerald-50/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-white shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="section-title">Opportunités automatiques</h2>
              <p className="text-xs text-muted-foreground">Détection des prochains leviers à transformer en brief, repost ou campagne.</p>
            </div>
          </div>
          <Badge variant="secondary">{opportunities.length} signal{opportunities.length > 1 ? "s" : ""}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {opportunities.map((opportunity) => (
          <article key={opportunity.id} className="flex min-h-[220px] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <Badge variant={opportunity.confidence === "Haute" ? "success" : "warning"} className="text-[10px]">
                {opportunity.confidence}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{opportunity.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{opportunity.impact}</p>
              <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                <div className="flex items-start gap-2">
                  <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-foreground/80">{opportunity.automation}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
              <span>{opportunity.evidence}</span>
              {opportunity.href && (
                <a href={opportunity.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                  Voir
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
