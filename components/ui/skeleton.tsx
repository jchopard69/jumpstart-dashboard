import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-muted/60", className)}
      {...props}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="card-surface relative overflow-hidden rounded-2xl border border-border/60 p-4">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500/30 via-violet-500/30 to-fuchsia-400/30" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export function TrendChartSkeleton() {
  return (
    <div className="card-surface rounded-2xl border border-border/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="h-48 flex items-end justify-between gap-1 px-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-full"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b border-border/60 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/70 p-3">
      <Skeleton className="h-3 w-20 mb-3" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card-surface rounded-2xl border border-border/60 p-6", className)}>
      <Skeleton className="h-5 w-40 mb-2" />
      <Skeleton className="h-4 w-60 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="flex items-start gap-4 border-b border-border pb-4">
      <Skeleton className="h-20 w-20 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
