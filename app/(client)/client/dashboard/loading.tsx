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
            <Skeleton className="h-3 w-32 mb-2.5" />
            <Skeleton className="h-9 w-52 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-16 rounded-xl" />
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
        </div>
        <div className="mt-6">
          <Skeleton className="h-9 w-[420px] rounded-xl" />
        </div>
      </section>

      {/* Score Card */}
      <section>
        <CardSkeleton className="h-56" />
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </section>

      {/* Insights + Collaboration */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" />
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
        <div className="card-surface rounded-2xl border border-border/60 p-6 lg:col-span-2">
          <Skeleton className="h-5 w-32 mb-1.5" />
          <Skeleton className="h-3.5 w-56 mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card-surface rounded-2xl border border-border/60 p-6">
            <Skeleton className="h-5 w-40 mb-1.5" />
            <Skeleton className="h-3.5 w-56 mb-4" />
            <TableSkeleton rows={4} cols={4} />
          </div>
          <div className="card-surface rounded-2xl border border-border/60 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Skeleton className="h-5 w-36 mb-1.5" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      </section>

      {/* Daily metrics */}
      <section>
        <div className="card-surface rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <TableSkeleton rows={7} cols={5} />
        </div>
      </section>
    </div>
  );
}
