import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  delta: number;
  suffix?: string;
  className?: string;
  index?: number;
};

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  const abs = Math.abs(delta);

  if (abs >= 10000) {
    // 10000+ → +10K%
    return `${sign}${Math.round(abs / 1000)}K%`;
  } else if (abs >= 1000) {
    // 1000-9999 → +1.2K%
    return `${sign}${(abs / 1000).toFixed(1).replace(".0", "")}K%`;
  }
  return `${sign}${Math.round(delta)}%`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(".0", "")}M`;
  }
  if (value >= 100_000) {
    return `${Math.round(value / 1000)}K`;
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\u00A0\u202F]/g, "\u2009");
}

export function KpiCard({ label, value, delta, suffix, className, index = 0 }: KpiCardProps) {
  const trend = delta >= 0 ? "up" : "down";
  const compact = formatCompact(value);
  const full = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\u00A0\u202F]/g, "\u2009");
  const isAbbreviated = compact !== full;
  const deltaValue = formatDelta(delta);

  return (
    <Card
      className={cn("card-surface relative overflow-hidden p-4 fade-in-up", className)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400" />
      <div className="flex items-center justify-between gap-1">
        <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {delta !== 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              trend === "up"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-600"
            )}
          >
            {deltaValue}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-semibold font-display">
          {compact}{suffix && <span className="text-xl ml-0.5">{suffix}</span>}
        </p>
        {isAbbreviated && (
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{full}</p>
        )}
      </div>
    </Card>
  );
}
