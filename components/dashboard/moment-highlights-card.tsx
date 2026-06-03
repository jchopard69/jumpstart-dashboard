import { CalendarDays, ExternalLink, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { MomentHighlight } from "@/lib/moment-highlights";

type MomentHighlightsCardProps = {
  highlights: MomentHighlight[];
};

function formatMetric(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export function MomentHighlightsCard({ highlights }: MomentHighlightsCardProps) {
  if (!highlights.length) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(237,233,254,0.72),rgba(240,253,248,0.78))] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-white/80 text-primary shadow-sm">
            <Zap className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div>
            <p className="section-label text-primary">Moments clés</p>
            <h2 className="mt-1 text-lg font-semibold tracking-normal font-display">Les journées qui ont changé la période</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Détection automatique des pics de visibilité ou d'engagement reliés aux contenus du jour.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {highlights.map((highlight) => {
          const platform = highlight.topPost?.platform as Platform | undefined;
          const platformLabel = platform ? PLATFORM_LABELS[platform] ?? platform : null;

          return (
            <article key={`${highlight.date}-${highlight.metric}`} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {highlight.label}
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  x{highlight.lift.toFixed(1)}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {highlight.metric}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums font-display">
                  {formatMetric(highlight.value)}
                </p>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{highlight.summary}</p>

              {highlight.topPost?.url ? (
                <a
                  href={highlight.topPost.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                >
                  Voir le contenu{platformLabel ? ` ${platformLabel}` : ""}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : platformLabel ? (
                <p className="mt-4 text-xs font-semibold text-primary">{platformLabel}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </Card>
  );
}
