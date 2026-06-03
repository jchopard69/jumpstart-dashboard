import { Card } from "@/components/ui/card";
import type { TrendTrajectoryItem } from "@/lib/trend-trajectory";

type TrendTrajectoryCardProps = {
  items: TrendTrajectoryItem[];
};

const toneByDirection = {
  up: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  down: "border-rose-500/20 bg-rose-500/10 text-rose-700",
  flat: "border-slate-500/20 bg-slate-500/10 text-slate-600",
};

export function TrendTrajectoryCard({ items }: TrendTrajectoryCardProps) {
  const visibleItems = items.slice(0, 4);
  if (visibleItems.length === 0) return null;

  return (
    <Card className="card-surface overflow-hidden p-0">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--secondary)/0.10),transparent)] p-5">
        <p className="section-label text-primary">Trajectoire du mois</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold font-display tracking-normal">
              Le rythme réel derrière les chiffres
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Une lecture compacte de la dynamique de fin de période, pour repérer ce qui accélère
              et ce qui demande une relance.
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {visibleItems.length} signaux suivis
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums font-display">
                  {item.valueLabel}
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums ${toneByDirection[item.direction]}`}
              >
                {item.changeLabel}
              </span>
            </div>
            <div className="mt-4 flex h-16 items-end gap-1.5">
              {item.bars.map((height, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="min-h-2 flex-1 rounded-t-md bg-primary/75"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
