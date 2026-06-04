import { Card } from "@/components/ui/card";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { PlatformMix } from "@/lib/platform-mix";

type PlatformMixCardProps = {
  mix: PlatformMix;
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function PlatformMixCard({ mix }: PlatformMixCardProps) {
  const visibleItems = mix.items.slice(0, 4);
  if (visibleItems.length === 0) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--secondary)/0.16),hsl(var(--primary)/0.08),transparent)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label text-primary">Mix de canaux</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal font-display">
              Où la présence sociale crée vraiment de la valeur
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Les pourcentages comparent chaque plateforme au total de la période : part du
              volume de visibilité disponible et part des engagements.
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {mix.concentrationLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => {
          const platform = item.platform as Platform;
          const rateLabel = item.engagementRate == null
            ? "N/A"
            : `${item.engagementRate.toLocaleString("fr-FR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%`;
          return (
            <article key={item.platform} className="rounded-xl border border-border/70 bg-background/85 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{PLATFORM_ICONS[platform]}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{PLATFORM_LABELS[platform]}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      {item.role}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-muted/50 px-2 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {rateLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Part visibilité</span>
                    <span className="tabular-nums">{formatPercent(item.visibilityShare)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.visibilityShare)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatNumber(item.visibilityValue)} {item.visibilityMetricLabel}
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Part engagements</span>
                    <span className="tabular-nums">{formatPercent(item.engagementShare)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, item.engagementShare)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatNumber(item.engagements)} engagements sur {formatNumber(item.postsCount)} posts
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
