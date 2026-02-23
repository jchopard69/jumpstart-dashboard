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

      {/* Score Card + Pulse */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2 h-56" />
        <CardSkeleton className="h-56" />
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </section>

      {/* Tabs skeleton */}
      <div>
        <div className="inline-flex h-11 items-center gap-1 rounded-xl bg-muted/50 p-1.5">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        {/* Default tab: Insights */}
        <div className="mt-6 space-y-4">
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <CardSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </section>
        </div>
      </div>
    </div>
  );
}
