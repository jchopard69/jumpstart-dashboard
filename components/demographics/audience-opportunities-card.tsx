import { Bot, MapPinned, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AudienceOpportunity } from "@/lib/audience-opportunities";

type AudienceOpportunitiesCardProps = {
  opportunities: AudienceOpportunity[];
};

export function AudienceOpportunitiesCard({ opportunities }: AudienceOpportunitiesCardProps) {
  if (!opportunities.length) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-white to-sky-50/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-white shadow-sm">
              <Target className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="section-title">Recommandations audience</h2>
              <p className="text-xs text-muted-foreground">
                Traduction automatique des segments en actions éditoriales et ciblage.
              </p>
            </div>
          </div>
          <Badge variant="secondary">{opportunities.length} piste{opportunities.length > 1 ? "s" : ""}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {opportunities.map((opportunity) => (
          <article key={opportunity.id} className="flex min-h-[230px] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPinned className="h-4 w-4" aria-hidden="true" />
              </div>
              <Badge variant={opportunity.confidence === "Haute" ? "success" : "warning"} className="text-[10px]">
                {opportunity.confidence}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{opportunity.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{opportunity.action}</p>
              <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                <div className="flex items-start gap-2">
                  <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-foreground/80">{opportunity.automation}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{opportunity.evidence}</span>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
