"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AdsKpiCardProps = {
  label: string;
  value: string;
  description?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  className?: string;
  index?: number;
};

function formatTrend(value: number): string {
  const sign = value >= 0 ? "+" : "";
  const rounded = Number(value.toFixed(1));
  if (rounded === Math.round(rounded)) {
    return `${sign}${Math.round(value)}%`;
  }
  return `${sign}${rounded}%`;
}

export function AdsKpiCard({
  label,
  value,
  description,
  trend,
  className,
  index = 0
}: AdsKpiCardProps) {
  return (
    <Card
      className={cn("card-surface relative overflow-hidden p-5 fade-in-up group", className)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Gradient accent bar */}
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400 opacity-70 transition-opacity group-hover:opacity-100" />

      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="section-label leading-tight truncate flex items-center gap-1">
          {label}
          {description && (
            <span
              title={description}
              className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-muted/60 text-[8px] font-medium text-muted-foreground cursor-help shrink-0"
            >
              ?
            </span>
          )}
        </p>
        {trend && trend.direction !== "neutral" && trend.value !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              trend.direction === "up"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-600"
            )}
          >
            <svg
              className="h-2.5 w-2.5 shrink-0"
              fill="none"
              viewBox="0 0 12 12"
              stroke="currentColor"
              strokeWidth={2}
            >
              {trend.direction === "up" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l4-4 4 4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
              )}
            </svg>
            {formatTrend(trend.value)}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-3xl font-semibold font-display tabular-nums">{value}</p>
      </div>
    </Card>
  );
}
