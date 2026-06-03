import { ArrowUpRight, Sparkles, Target, Wand2 } from "lucide-react";
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
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(37,99,235,0.84))] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Opportunités</h2>
              <p className="mt-1 text-xs text-white/70">Les leviers les plus crédibles détectés dans les contenus de la période.</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
            {opportunities.length} signal{opportunities.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {opportunities.map((opportunity, index) => (
          <article key={opportunity.id} className="flex min-h-[220px] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <Badge variant={opportunity.confidence === "Haute" ? "success" : "warning"} className="text-[10px]">
                Confiance {opportunity.confidence.toLowerCase()}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <p className="text-[11px] font-semibold uppercase text-primary">Levier {index + 1}</p>
              <h3 className="text-sm font-semibold leading-snug text-foreground">{opportunity.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{opportunity.impact}</p>
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
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
