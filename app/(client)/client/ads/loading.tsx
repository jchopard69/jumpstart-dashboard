import {
  KpiCardSkeleton,
  TrendChartSkeleton,
  TableSkeleton,
  Skeleton
} from "@/components/ui/skeleton";

export default function AdsLoading() {
  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <TrendChartSkeleton key={i} />
        ))}
      </section>

      {/* Campaigns + Platform breakdown */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface rounded-2xl border border-border/60 p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          <TableSkeleton rows={5} cols={6} />
        </div>
        <div className="card-surface rounded-2xl border border-border/60 p-6">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
