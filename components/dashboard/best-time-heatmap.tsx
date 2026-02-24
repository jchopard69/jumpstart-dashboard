"use client";

import { Card } from "@/components/ui/card";
import type { BestTimeData } from "@/lib/best-time";
import { DAY_LABELS, HOUR_LABELS } from "@/lib/best-time";

type BestTimeHeatmapProps = {
  data: BestTimeData;
};

function getColor(intensity: number, postCount: number): string {
  if (postCount === 0) return "bg-muted/20";
  if (intensity >= 0.8) return "bg-emerald-500";
  if (intensity >= 0.6) return "bg-emerald-400";
  if (intensity >= 0.4) return "bg-violet-400";
  if (intensity >= 0.2) return "bg-violet-300";
  return "bg-muted/40";
}

function getTextColor(intensity: number, postCount: number): string {
  if (postCount === 0) return "text-muted-foreground/40";
  if (intensity >= 0.6) return "text-white";
  return "text-muted-foreground";
}

export function BestTimeHeatmap({ data }: BestTimeHeatmapProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="section-title">Meilleur moment pour publier</h2>
            <p className="text-xs text-muted-foreground">
              Basé sur {data.totalPostsAnalyzed} publications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded bg-muted/40" />
          <span>Faible</span>
          <span className="inline-block h-3 w-3 rounded bg-violet-400" />
          <span>Moyen</span>
          <span className="inline-block h-3 w-3 rounded bg-emerald-500" />
          <span>Fort</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(6,1fr)] gap-1 mb-1">
            <div />
            {HOUR_LABELS.map((label) => (
              <div key={label} className="text-center text-[10px] text-muted-foreground font-medium">
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {DAY_LABELS.map((dayLabel, dayIndex) => (
            <div key={dayLabel} className="grid grid-cols-[60px_repeat(6,1fr)] gap-1 mb-1">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                {dayLabel}
              </div>
              {HOUR_LABELS.map((_, hourIndex) => {
                const slot = data.slots.find(s => s.day === dayIndex && s.hour === hourIndex);
                const intensity = slot?.intensity ?? 0;
                const postCount = slot?.postCount ?? 0;
                const color = getColor(intensity, postCount);
                const textColor = getTextColor(intensity, postCount);

                return (
                  <div
                    key={hourIndex}
                    className={`flex items-center justify-center rounded-lg h-10 ${color} transition-colors cursor-default`}
                    title={
                      postCount > 0
                        ? `${dayLabel} ${HOUR_LABELS[hourIndex]} — ${postCount} post${postCount > 1 ? "s" : ""}, ~${Math.round(slot?.avgEngagement ?? 0)} eng. moyen`
                        : `${dayLabel} ${HOUR_LABELS[hourIndex]} — Aucun post`
                    }
                  >
                    {postCount > 0 && (
                      <span className={`text-[10px] font-medium tabular-nums ${textColor}`}>
                        {postCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Best time summary */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5">
        <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-emerald-700">
          Meilleur créneau : <span className="font-semibold">{data.bestDay}</span> entre <span className="font-semibold">{data.bestHour}</span>
        </p>
      </div>
    </Card>
  );
}
