import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  delta: number;
  suffix?: string;
  className?: string;
};

export function KpiCard({ label, value, delta, suffix, className }: KpiCardProps) {
  const trend = delta >= 0 ? "up" : "down";
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  const deltaValue = `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`;

  return (
    <Card className={cn("card-surface relative overflow-hidden p-4 fade-in-up", className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
        {delta !== 0 && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
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
          {formatted}{suffix && <span className="text-xl ml-0.5">{suffix}</span>}
        </p>
      </div>
    </Card>
  );
}
