import {
  KpiCardSkeleton,
  TrendChartSkeleton,
  TableSkeleton,
  PostSkeleton,
  CardSkeleton,
  Skeleton
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Skeleton className="h-3 w-40 mb-2" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </section>

      {/* Insights + Ads + Collaboration */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <TrendChartSkeleton key={i} />
        ))}
      </section>

      {/* Top posts + Platform table + Sync */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface rounded-2xl border border-border/60 p-6 lg:col-span-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface rounded-2xl border border-border/60 p-6">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-72 mb-4" />
            <TableSkeleton rows={4} cols={6} />
          </div>
          <div className="card-surface rounded-2xl border border-border/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Daily metrics */}
      <section>
        <div className="card-surface rounded-2xl border border-border/60 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <TableSkeleton rows={7} cols={5} />
        </div>
      </section>
    </div>
  );
}
