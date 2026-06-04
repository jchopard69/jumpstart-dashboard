import { Card } from "@/components/ui/card";
import { computeEngagementRate } from "@/lib/metrics";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { PlatformData } from "@/lib/types/dashboard";

type PlatformBreakdownCardProps = {
  platforms: PlatformData[];
};

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function formatEvolution(value?: number) {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  const sign = value > 0 ? "+" : "";
  const fractionDigits = Math.abs(value) < 10 && !Number.isInteger(value) ? 1 : 0;
  return `${sign}${value.toLocaleString("fr-FR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

function evolutionClassName(value?: number) {
  if (value == null || value === 0) return "";
  return value > 0
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-600";
}

function formatRate(value: number | null) {
  if (value == null) return "N/A";
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function PlatformBreakdownCard({ platforms }: PlatformBreakdownCardProps) {
  const visiblePlatforms = [...platforms]
    .filter((item) => item.totals.followers + item.totals.views + item.totals.reach + item.totals.engagements + item.totals.posts_count > 0)
    .sort((a, b) => {
      const aVisibility = a.totals.views > 0 ? a.totals.views : a.totals.reach;
      const bVisibility = b.totals.views > 0 ? b.totals.views : b.totals.reach;
      return bVisibility + b.totals.engagements * 5 - (aVisibility + a.totals.engagements * 5);
    });

  if (visiblePlatforms.length === 0) return null;

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-white/80 p-5">
        <p className="section-label text-primary">Détail par plateforme</p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal font-display">
          Les chiffres clés de chaque canal
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Vue consolidée par réseau pour comparer rapidement volume d'audience, visibilité, engagement et production.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/25 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-5 py-3 font-semibold">Plateforme</th>
              <th className="px-4 py-3 text-right font-semibold">Abonnés</th>
              <th className="px-4 py-3 text-right font-semibold">Vues</th>
              <th className="px-4 py-3 text-right font-semibold">Portée</th>
              <th className="px-4 py-3 text-right font-semibold">Engagements</th>
              <th className="px-4 py-3 text-right font-semibold">Posts</th>
              <th className="px-5 py-3 text-right font-semibold">Taux d'eng.</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlatforms.map((item) => {
              const platform = item.platform as Platform;
              const engagementRate = computeEngagementRate(
                item.totals.engagements,
                item.totals.views,
                item.totals.reach
              );
              const cells = [
                { value: item.totals.followers, delta: item.delta?.followers },
                { value: item.totals.views, delta: item.delta?.views, unavailable: !item.available.views },
                { value: item.totals.reach, delta: item.delta?.reach, unavailable: !item.available.reach },
                { value: item.totals.engagements, delta: item.delta?.engagements, unavailable: !item.available.engagements },
                { value: item.totals.posts_count, delta: item.delta?.posts_count },
              ];

              return (
                <tr key={item.platform} className="border-b border-border/50 last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{PLATFORM_ICONS[platform]}</span>
                      <div>
                        <p className="font-semibold text-foreground">{PLATFORM_LABELS[platform]}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.available.views ? "Vues disponibles" : item.available.reach ? "Portée disponible" : "Visibilité partielle"}
                        </p>
                      </div>
                    </div>
                  </td>
                  {cells.map((cell, index) => {
                    const evolution = formatEvolution(cell.delta);
                    return (
                      <td key={index} className="px-4 py-4 text-right tabular-nums">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cell.unavailable ? "text-muted-foreground/60" : "font-semibold text-foreground"}>
                            {cell.unavailable ? "N/A" : formatNumber(cell.value)}
                          </span>
                          {evolution && !cell.unavailable ? (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${evolutionClassName(cell.delta)}`}>
                              Evol. {evolution}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
                    {formatRate(engagementRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
