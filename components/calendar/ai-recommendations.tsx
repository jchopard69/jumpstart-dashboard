"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import type { Recommendation } from "./calendar-view";

type AiRecommendationsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  month: string;
  onAddToCalendar: (rec: Recommendation) => void;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

export function AiRecommendations({
  open,
  onOpenChange,
  tenantId,
  month,
  onAddToCalendar,
}: AiRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/calendar/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, month }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message ?? "Erreur lors de la generation.");
        return;
      }

      setRecommendations(data.recommendations ?? []);
      setHasGenerated(true);
    } catch {
      setError("Erreur reseau. Verifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Suggestions IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!hasGenerated && !loading && (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                <Sparkles className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                Generez des idees de contenu
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                L'IA analysera vos donnees Content DNA et vos tendances d'engagement
                pour suggerer 5 idees de contenu personnalisees.
              </p>
              <Button onClick={generate} disabled={loading}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generer des suggestions
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
              <p className="text-sm text-muted-foreground">
                Analyse de vos donnees en cours...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
                  Reessayer
                </Button>
              </div>
            </div>
          )}

          {hasGenerated && !loading && recommendations.length === 0 && !error && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Aucune suggestion generee. Reessayez plus tard.
              </p>
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {recommendations.length} suggestion{recommendations.length > 1 ? "s" : ""}
                </p>
                <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
                  <Sparkles className="mr-1 h-3 w-3" />
                  Regenerer
                </Button>
              </div>

              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/60 p-4 space-y-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">
                        {rec.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddToCalendar(rec)}
                      className="shrink-0"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Ajouter
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {rec.platform && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {PLATFORM_LABELS[rec.platform] ?? rec.platform}
                      </Badge>
                    )}
                    {rec.suggested_day && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(rec.suggested_day + "T00:00:00").toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                    {rec.suggested_time && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        a {rec.suggested_time}
                      </span>
                    )}
                    {rec.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-purple-50 text-purple-700 rounded-md px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
